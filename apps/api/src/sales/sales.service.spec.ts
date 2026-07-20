import { SalesService } from './sales.service';

describe('SalesService.aggregateLines', () => {
  const service = Object.create(SalesService.prototype) as SalesService;

  it('aggregates duplicate productIds and sorts ascending', () => {
    const lines = service.aggregateLines([
      { productId: 'b', quantity: 2 },
      { productId: 'a', quantity: 1 },
      { productId: 'b', quantity: 3 },
    ]);
    expect(lines).toEqual([
      { productId: 'a', quantity: 1 },
      { productId: 'b', quantity: 5 },
    ]);
  });
});
