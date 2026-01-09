/**
 * Keep-warm utility for Render free tier
 * Pings the service every 14 minutes to prevent spin-down
 */

let keepWarmInterval: NodeJS.Timeout | null = null;

export function startKeepWarm(serviceUrl?: string): void {
  if (!serviceUrl) {
    console.log('SERVICE_URL not set - keep-warm disabled');
    return;
  }

  // Ping every 14 minutes (Render spins down after 15 min of inactivity)
  const INTERVAL = 14 * 60 * 1000;

  keepWarmInterval = setInterval(async () => {
    try {
      const response = await fetch(`${serviceUrl}/health`);
      if (response.ok) {
        console.log(`Keep-warm ping successful: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Keep-warm ping failed:', error);
    }
  }, INTERVAL);

  console.log(`Keep-warm started: pinging ${serviceUrl} every 14 minutes`);
}

export function stopKeepWarm(): void {
  if (keepWarmInterval) {
    clearInterval(keepWarmInterval);
    keepWarmInterval = null;
    console.log('Keep-warm stopped');
  }
}
