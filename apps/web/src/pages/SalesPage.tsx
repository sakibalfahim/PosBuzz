import { Button, Drawer, Table, Typography, Descriptions } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { salesApi, type Sale } from '../api/types';

export function SalesPage() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Sale | null>(null);

  const list = useQuery({
    queryKey: ['sales', page],
    queryFn: () => salesApi.list({ page, limit: 20 }),
  });

  const detail = useQuery({
    queryKey: ['sales', selected?.id],
    queryFn: () => salesApi.get(selected!.id),
    enabled: !!selected,
  });

  return (
    <>
      <Typography.Title level={3}>Sales</Typography.Title>
      <Table
        rowKey="id"
        loading={list.isLoading}
        dataSource={list.data?.data ?? []}
        pagination={{
          current: page,
          pageSize: 20,
          total: list.data?.meta.total ?? 0,
          onChange: setPage,
        }}
        columns={[
          {
            title: 'Sale ID',
            dataIndex: 'id',
            render: (id: string) => id.slice(0, 8) + '…',
          },
          {
            title: 'Total',
            dataIndex: 'totalAmount',
            render: (v: string) => `$${v}`,
          },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: '',
            render: (_, row) => (
              <Button type="link" onClick={() => setSelected(row)}>
                View
              </Button>
            ),
          },
        ]}
      />

      <Drawer
        title="Sale detail"
        open={!!selected}
        onClose={() => setSelected(null)}
        width={480}
      >
        {detail.data && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="ID">{detail.data.id}</Descriptions.Item>
              <Descriptions.Item label="Total">
                ${detail.data.totalAmount}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {new Date(detail.data.createdAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
            <Table
              style={{ marginTop: 16 }}
              rowKey="id"
              pagination={false}
              size="small"
              dataSource={detail.data.items}
              columns={[
                {
                  title: 'Product',
                  render: (_, i) => `${i.product.name} (${i.product.sku})`,
                },
                { title: 'Qty', dataIndex: 'quantity', width: 60 },
                {
                  title: 'Unit',
                  dataIndex: 'unitPrice',
                  render: (v: string) => `$${v}`,
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </>
  );
}
