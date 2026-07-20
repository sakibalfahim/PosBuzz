import { ConflictException, NotFoundException } from '@nestjs/common';

export class InsufficientStockException extends ConflictException {
  constructor(skuOrId: string, name?: string) {
    const label = name ? `${name} (${skuOrId})` : skuOrId;
    super({
      statusCode: 409,
      error: 'InsufficientStock',
      message: `Insufficient stock for product ${label}`,
    });
  }
}

export class ProductNotFoundException extends NotFoundException {
  constructor(id: string) {
    super({
      statusCode: 404,
      error: 'Not Found',
      message: `Product ${id} not found`,
    });
  }
}

export class ProductHasSaleHistoryException extends ConflictException {
  constructor(id: string) {
    super({
      statusCode: 409,
      error: 'Conflict',
      message: `Cannot delete product ${id}: it has sale history`,
    });
  }
}
