export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'fallback_access',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh',
  },
  external: {
    exchangeRateApi: process.env.EXCHANGE_RATE_API_URL || 'https://api.exchangerate-api.com/v4/latest',
  }
});
