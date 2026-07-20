import { Form, Input, Button, Typography, Alert, Card } from 'antd';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/products" replace />;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(160deg, #f5f7fa 0%, #e4ebf5 100%)',
        padding: 24,
      }}
    >
      <Card style={{ width: 400, maxWidth: '100%' }}>
        <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 4 }}>
          PosBuzz
        </Typography.Title>
        <Typography.Paragraph type="secondary">Sign in to the POS</Typography.Paragraph>
        {waking && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Waking up the API…"
            description="Free-tier hosts may take up to a minute after idle."
          />
        )}
        {error && (
          <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error} />
        )}
        <Form
          layout="vertical"
          onFinish={async (values: { email: string; password: string }) => {
            setError(null);
            setSubmitting(true);
            setWaking(false);
            try {
              await login(values.email, values.password, () => setWaking(true));
              navigate('/products');
            } catch (e) {
              setError(e instanceof ApiError ? e.message : 'Login failed');
            } finally {
              setSubmitting(false);
              setWaking(false);
            }
          }}
          initialValues={{ email: 'demo@posbuzz.dev' }}
        >
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Sign in
          </Button>
        </Form>
      </Card>
    </div>
  );
}
