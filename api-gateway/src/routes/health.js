router.get('/api/v1/health', async (req, res) => {
  try {
    const [paymentHealth, notificationHealth] = await Promise.all([
      fetch('http://payment-service:3001/health').then(r => r.json()),
      fetch('http://notification-service:3002/health').then(r => r.json())
    ]);

    res.json({
      gateway: "ok",
      services: {
        payment: paymentHealth,
        notification: notificationHealth
      }
    });
  } catch (error) {
    res.status(503).json({ status: "partial_outage", error: error.message });
  }
});