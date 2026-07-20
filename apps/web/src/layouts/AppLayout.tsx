import { Layout, Menu, Typography, Button, theme } from 'antd';
import {
  ShoppingOutlined,
  AppstoreOutlined,
  DollarOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selected = location.pathname.startsWith('/sales')
    ? '/sales'
    : location.pathname.startsWith('/new-sale')
      ? '/new-sale'
      : '/products';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div style={{ padding: '16px 20px' }}>
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            PosBuzz
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={[
            {
              key: '/products',
              icon: <AppstoreOutlined />,
              label: <Link to="/products">Products</Link>,
            },
            {
              key: '/new-sale',
              icon: <ShoppingOutlined />,
              label: <Link to="/new-sale">New Sale</Link>,
            },
            {
              key: '/sales',
              icon: <DollarOutlined />,
              label: <Link to="/sales">Sales</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            paddingInline: 24,
          }}
        >
          <Typography.Text type="secondary">{user?.email}</Typography.Text>
          <Button
            icon={<LogoutOutlined />}
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            Logout
          </Button>
        </Header>
        <Content style={{ margin: 24 }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
