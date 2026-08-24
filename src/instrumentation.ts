export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initialize_database } = await import('./server/database-initializer')
    await initialize_database()
  }
}
