import {
  Alert,
  Button,
  InputNumber,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { productsApi, salesApi } from '../api/types';
import { ApiError } from '../api/client';

function newKey(): string {
  return crypto.randomUUID();
}

type Line = { key: string; productId?: string; quantity: number };

export function NewSalePage() {
  const qc = useQueryClient();
  const [lines, setLines] = useState<Line[]>([{ key: newKey(), quantity: 1 }]);
  const [waking, setWaking] = useState(false);

  const products = useQuery({
    queryKey: ['products', 'all-for-sale'],
    queryFn: () => productsApi.list({ page: 1, limit: 100 }),
  });

  const productMap = useMemo(() => {
    const m = new Map<string, { name: string; sku: string; price: string; stock: number }>();
    for (const p of products.data?.data ?? []) {
      m.set(p.id, {
        name: p.name,
        sku: p.sku,
        price: p.price,
        stock: p.stockQuantity,
      });
    }
    return m;
  }, [products.data]);

  const total = useMemo(() => {
    let cents = 0n;
    for (const line of lines) {
      if (!line.productId) continue;
      const p = productMap.get(line.productId);
      if (!p) continue;
      const [whole, frac = '00'] = p.price.split('.');
      const priceCents = BigInt(whole) * 100n + BigInt((frac + '00').slice(0, 2));
      cents += priceCents * BigInt(line.quantity);
    }
    const whole = cents / 100n;
    const frac = (cents % 100n).toString().padStart(2, '0');
    return `${whole}.${frac}`;
  }, [lines, productMap]);

  const create = useMutation({
    mutationFn: async () => {
      const items = lines
        .filter((l) => l.productId)
        .map((l) => ({ productId: l.productId!, quantity: l.quantity }));
      if (items.length === 0) throw new Error('Add at least one line');
      const key = newKey();
      setWaking(false);
      return salesApi.create(items, key, () => setWaking(true));
    },
    onSuccess: (sale) => {
      message.success(`Sale ${sale.id.slice(0, 8)}… recorded`);
      setLines([{ key: newKey(), quantity: 1 }]);
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['sales'] });
      setWaking(false);
    },
    onError: (e: Error) => {
      setWaking(false);
      message.error(e instanceof ApiError ? e.message : e.message);
    },
  });

  return (
    <>
      <Typography.Title level={3}>New Sale</Typography.Title>
      {waking && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Waking up the API…"
        />
      )}
      <Table
        rowKey="key"
        pagination={false}
        dataSource={lines}
        columns={[
          {
            title: 'Product',
            render: (_, row) => (
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: '100%', minWidth: 220 }}
                placeholder="Select product"
                value={row.productId}
                options={(products.data?.data ?? []).map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.sku}) — $${p.price} · stock ${p.stockQuantity}`,
                }))}
                onChange={(productId) =>
                  setLines((prev) =>
                    prev.map((l) => (l.key === row.key ? { ...l, productId } : l)),
                  )
                }
              />
            ),
          },
          {
            title: 'Qty',
            width: 120,
            render: (_, row) => (
              <InputNumber
                min={1}
                value={row.quantity}
                onChange={(v) =>
                  setLines((prev) =>
                    prev.map((l) =>
                      l.key === row.key ? { ...l, quantity: Number(v) || 1 } : l,
                    ),
                  )
                }
              />
            ),
          },
          {
            title: 'Line',
            width: 120,
            render: (_, row) => {
              if (!row.productId) return '—';
              const p = productMap.get(row.productId);
              if (!p) return '—';
              const [whole, frac = '00'] = p.price.split('.');
              const cents =
                (BigInt(whole) * 100n + BigInt((frac + '00').slice(0, 2))) *
                BigInt(row.quantity);
              return `$${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
            },
          },
          {
            title: '',
            width: 90,
            render: (_, row) => (
              <Button
                danger
                type="link"
                disabled={lines.length === 1}
                onClick={() => setLines((prev) => prev.filter((l) => l.key !== row.key))}
              >
                Remove
              </Button>
            ),
          },
        ]}
      />
      <Space style={{ marginTop: 16, width: '100%', justifyContent: 'space-between' }}>
        <Button onClick={() => setLines((prev) => [...prev, { key: newKey(), quantity: 1 }])}>
          Add line
        </Button>
        <Space>
          <Typography.Text strong>Total: ${total}</Typography.Text>
          <Button
            type="primary"
            loading={create.isPending}
            disabled={create.isPending}
            onClick={() => create.mutate()}
          >
            Complete sale
          </Button>
        </Space>
      </Space>
    </>
  );
}
