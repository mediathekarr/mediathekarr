export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initCacheTTL } = await import("@/lib/cache");
    await initCacheTTL();
    console.log("Cache TTL initialized from database");
  }
}
