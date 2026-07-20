import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProductHasSaleHistoryException,
  ProductNotFoundException,
} from '../common/exceptions/domain.exceptions';
import { decimalToString } from '../common/utils/money';
import type { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(p: {
    id: string;
    name: string;
    sku: string;
    price: Prisma.Decimal;
    stockQuantity: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: decimalToString(p.price),
      stockQuantity: p.stockQuantity,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private assertValidPrice(price: string): Prisma.Decimal {
    let d: Prisma.Decimal;
    try {
      d = new Prisma.Decimal(price);
    } catch {
      throw new BadRequestException('Invalid price');
    }
    if (d.lte(0)) {
      throw new BadRequestException('price must be greater than 0');
    }
    return d.toDecimalPlaces(2);
  }

  async create(dto: CreateProductDto) {
    const price = this.assertValidPrice(dto.price);
    try {
      const product = await this.prisma.product.create({
        data: {
          name: dto.name.trim(),
          sku: dto.sku.trim().toUpperCase(),
          price,
          stockQuantity: dto.stockQuantity,
        },
      });
      return this.serialize(product);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('SKU already exists');
      }
      throw e;
    }
  }

  async findAll(query: ProductQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = {};
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      data: items.map((p) => this.serialize(p)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new ProductNotFoundException(id);
    return this.serialize(product);
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.sku !== undefined) data.sku = dto.sku.trim().toUpperCase();
    if (dto.price !== undefined) data.price = this.assertValidPrice(dto.price);
    if (dto.stockQuantity !== undefined) data.stockQuantity = dto.stockQuantity;
    try {
      const product = await this.prisma.product.update({ where: { id }, data });
      return this.serialize(product);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('SKU already exists');
      }
      throw e;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    const refs = await this.prisma.saleItem.count({ where: { productId: id } });
    if (refs > 0) {
      throw new ProductHasSaleHistoryException(id);
    }
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }
}
