import { env } from './lib/env.js'
import { prisma } from './lib/prisma.js'
import { app } from './app.js'

const port = parseInt(env.PORT, 10)

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 API server running on ${env.API_URL}`)
  // eslint-disable-next-line no-console
  console.log(`📖 Health check: ${env.API_URL}/health`)
  // eslint-disable-next-line no-console
  console.log(`📚 API docs: ${env.API_URL}/docs`)
  // eslint-disable-next-line no-console
  console.log(`🔒 Environment: ${env.NODE_ENV}`)
})

// Graceful shutdown
const gracefulShutdown = () => {
  // eslint-disable-next-line no-console
  console.log('\n🛑 Shutting down gracefully...')

  server.close(async () => {
    // eslint-disable-next-line no-console
    console.log('✅ HTTP server closed')

    try {
      await prisma.$disconnect()
      // eslint-disable-next-line no-console
      console.log('✅ Database connection closed')
      process.exit(0)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Error disconnecting from database:', error)
      process.exit(1)
    }
  })

  // Force shutdown after 10 seconds
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('⚠️  Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)
