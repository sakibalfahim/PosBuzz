import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  InsufficientStockException,
  ProductNotFoundException,
} from '../common/exceptions/domain.exceptions';
import { decimalToString } from '../common/utils/money';
import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../redis/redis.interfaces';
import type { CreateSaleDto, SaleQueryDto } from './dto/sale.dto';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

type AggregatedLine = { productId: string; quantity: number };

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
  ) {}

  /** Aggregate duplicate productIds; sort ids ascending (deadlock avoidance). */
  aggregateLines(items: { productId: string; quantity: number }[]): AggregatedLine[] {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return [...map.entries()]
      .map(([productId, quantity]) => ({ productId, quantity }))
      .sort((a, b) => a.productId.localeCompare(b.productId));
  }

  private serializeSale(sale: {
    id: string;
    userId: string;
    totalAmount: Prisma.Decimal;
    createdAt: Date;
    items: Array<{
      id: string;
      productId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      product: { id: string; name: string; sku: string };
    }>;
  }) {
    return {
      id: sale.id,
      userId: sale.userId,
      totalAmount: decimalToString(sale.totalAmount),
      createdAt: sale.createdAt.toISOString(),
      items: sale.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: decimalToString(i.unitPrice),
        product: {
          id: i.product.id,
          name: i.product.name,
          sku: i.product.sku,
        },
      })),
    };
  }

  private saleInclude = {
    items: {
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    },
  } as const;

  async findAll(userId: string, query: SaleQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = { userId };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        include: this.saleInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      data: items.map((s) => this.serializeSale(s)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(userId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, userId },
      include: this.saleInclude,
    });
    if (!sale) {
      throw new NotFoundException(`Sale ${id} not found`);
    }
    return this.serializeSale(sale);
  }

  private async waitForIdempotentSale(userId: string, key: string) {
    for (let i = 0; i < 20; i++) {
      const id = await this.idempotency.get(key);
      if (id && !id.startsWith('pending:')) {
        return this.findOne(userId, id);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    const finalId = await this.idempotency.get(key);
    if (finalId && !finalId.startsWith('pending:')) {
      return this.findOne(userId, finalId);
    }
    return null;
  }

  async create(userId: string, dto: CreateSaleDto, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existingId = await this.idempotency.get(idempotencyKey);
      if (existingId && !existingId.startsWith('pending:')) {
        return this.findOne(userId, existingId);
      }
    }

    let claimedKey: string | undefined;
    let placeholderId: string | undefined;

    if (idempotencyKey) {
      placeholderId = `pending:${randomUUID()}`;
      const claimed = await this.idempotency.claim(
        idempotencyKey,
        placeholderId,
        IDEMPOTENCY_TTL_SECONDS,
      );
      if (!claimed) {
        const sale = await this.waitForIdempotentSale(userId, idempotencyKey);
        if (sale) return sale;
      } else {
        claimedKey = idempotencyKey;
      }
    }

    const lines = this.aggregateLines(dto.items);
    const ids = lines.map((l) => l.productId);

    try {
      const sale = await this.prisma.$transaction(async (tx) => {
        const products = await tx.product.findMany({
          where: { id: { in: ids } },
        });
        const byId = new Map(products.map((p) => [p.id, p]));

        for (const line of lines) {
          if (!byId.has(line.productId)) {
            throw new ProductNotFoundException(line.productId);
          }
        }

        for (const line of lines) {
          const product = byId.get(line.productId)!;
          const res = await tx.product.updateMany({
            where: {
              id: line.productId,
              stockQuantity: { gte: line.quantity },
            },
            data: { stockQuantity: { decrement: line.quantity } },
          });
          if (res.count === 0) {
            throw new InsufficientStockException(product.sku, product.name);
          }
        }

        let total = new Prisma.Decimal(0);
        const itemCreates: Array<{
          productId: string;
          quantity: number;
          unitPrice: Prisma.Decimal;
        }> = [];

        for (const line of lines) {
          const product = byId.get(line.productId)!;
          const unitPrice = product.price;
          total = total.plus(unitPrice.mul(line.quantity));
          itemCreates.push({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice,
          });
        }

        return tx.sale.create({
          data: {
            userId,
            totalAmount: total.toDecimalPlaces(2),
            items: { create: itemCreates },
          },
          include: this.saleInclude,
        });
      });

      if (claimedKey) {
        await this.idempotency.set(claimedKey, sale.id, IDEMPOTENCY_TTL_SECONDS);
      }

      return this.serializeSale(sale);
    } catch (e) {
      if (claimedKey && placeholderId) {
        const current = await this.idempotency.get(claimedKey);
        if (current === placeholderId) {
          await this.idempotency.del(claimedKey);
        }
      }
      throw e;
    }
  }
}
