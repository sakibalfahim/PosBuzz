import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { productsApi, type Product } from '../api/types';
import { ApiError } from '../api/client';

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['products', page, search],
    queryFn: () => productsApi.list({ page, limit: 20, q: search || undefined }),
  });

  const save = useMutation({
    mutationFn: async (values: {
      name: string;
      sku: string;
      price: string;
      stockQuantity: number;
    }) => {
      if (editing) {
        return productsApi.update(editing.id, values);
      }
      return productsApi.create(values);
    },
    onSuccess: () => {
      message.success(editing ? 'Product updated' : 'Product created');
      setOpen(false);
      setEditing(null);
      form.resetFields();
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: Error) => {
      message.error(e instanceof ApiError ? e.message : 'Save failed');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => {
      message.success('Product deleted');
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: Error) => {
      message.error(e instanceof ApiError ? e.message : 'Delete failed');
    },
  });

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Products
        </Typography.Title>
        <Space wrap>
          <Input
            allowClear
            placeholder="Search name or SKU"
            prefix={<SearchOutlined />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={() => {
              setPage(1);
              setSearch(q.trim());
            }}
            style={{ width: 220 }}
          />
          <Button
            onClick={() => {
              setPage(1);
              setSearch(q.trim());
            }}
          >
            Search
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            Add product
          </Button>
        </Space>
      </Space>

      {list.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Could not load products"
          description={
            list.error instanceof ApiError
              ? list.error.message
              : list.error instanceof Error
                ? list.error.message
                : 'Unknown error'
          }
        />
      )}

      <Table
        rowKey="id"
        loading={list.isLoading || list.isFetching}
        dataSource={list.data?.data ?? []}
        locale={{ emptyText: list.isError ? ' ' : 'No products yet — use Add product or run db:seed' }}
        pagination={{
          current: page,
          pageSize: 20,
          total: list.data?.meta.total ?? 0,
          onChange: setPage,
        }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'SKU', dataIndex: 'sku' },
          {
            title: 'Price',
            dataIndex: 'price',
            render: (v: string) => `$${v}`,
          },
          { title: 'Stock', dataIndex: 'stockQuantity' },
          {
            title: 'Actions',
            render: (_, row) => (
              <Space>
                <Button
                  size="small"
                  onClick={() => {
                    setEditing(row);
                    form.setFieldsValue({
                      name: row.name,
                      sku: row.sku,
                      price: row.price,
                      stockQuantity: row.stockQuantity,
                    });
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Popconfirm
                  title="Delete this product?"
                  onConfirm={() => remove.mutate(row.id)}
                >
                  <Button size="small" danger>
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Edit product' : 'Add product'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            save.mutate({
              name: values.name,
              sku: values.sku,
              price: String(values.price),
              stockQuantity: values.stockQuantity,
            });
          }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sku" label="SKU" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="price"
            label="Price"
            rules={[{ required: true, message: 'Enter price as decimal string' }]}
          >
            <Input placeholder="12.50" />
          </Form.Item>
          <Form.Item
            name="stockQuantity"
            label="Stock"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
