export const register = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeDatabase } = await import('./server/database-initializer')
    await initializeDatabase()
  }
}
