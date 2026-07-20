import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

describe('PosBuzz API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
      ],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.saleItem.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('DemoPass123!', 12);
    await prisma.user.create({
      data: { email: 'demo@posbuzz.dev', passwordHash },
    });

    const product = await prisma.product.create({
      data: {
        name: 'Race Widget',
        sku: 'RACE-001',
        price: new Prisma.Decimal('10.00'),
        stockQuantity: 1,
      },
    });
    productId = product.id;

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@posbuzz.dev', password: 'DemoPass123!' })
      .expect(200);

    token = login.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is liveness', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects oversell with 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId, quantity: 2 }] })
      .expect(409);
  });

  it('oversell race: only one of two concurrent sales succeeds', async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: 1 },
    });

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ productId, quantity: 1 }] }),
      request(app.getHttpServer())
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ productId, quantity: 1 }] }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409].sort());
    // Nest default POST success is 201 if @HttpCode not set — actually Nest returns 201 for POST by default
    const okCount = [a.status, b.status].filter((s) => s === 201 || s === 200).length;
    const conflictCount = [a.status, b.status].filter((s) => s === 409).length;
    expect(okCount).toBe(1);
    expect(conflictCount).toBe(1);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.stockQuantity).toBe(0);
  });

  it('idempotent sale replay returns same sale', async () => {
    const p = await prisma.product.create({
      data: {
        name: 'Idem Widget',
        sku: 'IDEM-001',
        price: new Prisma.Decimal('5.00'),
        stockQuantity: 10,
      },
    });

    const key = `test-idem-${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ items: [{ productId: p.id, quantity: 1 }] });

    expect([200, 201]).toContain(first.status);

    const second = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ items: [{ productId: p.id, quantity: 1 }] });

    expect([200, 201]).toContain(second.status);
    expect(second.body.id).toBe(first.body.id);

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(updated.stockQuantity).toBe(9);
  });

  it('logout denylists JWT', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@posbuzz.dev', password: 'DemoPass123!' })
      .expect(200);

    const t = login.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${t}`)
      .expect(401);
  });
});
