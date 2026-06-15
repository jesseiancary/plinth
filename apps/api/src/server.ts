import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import { prisma } from './lib/prisma.js'
import { app } from './app.js'

const port = parseInt(env.PORT, 10)

const server = app.listen(port, () => {
  logger.info('Server started', {
    port,
    apiUrl: env.API_URL,
    environment: env.NODE_ENV,
    nodeVersion: process.version,
    healthCheckUrl: `${env.API_URL}/health`,
    apiDocsUrl: `${env.API_URL}/docs`,
  })
})

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info('🛑 Graceful shutdown initiated')

  server.close(async () => {
    logger.info('✅ HTTP server closed')

    try {
      await prisma.$disconnect()
      logger.info('✅ Database connection closed')
      process.exit(0)
    } catch (error) {
      logger.error('❌ Error disconnecting from database', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      process.exit(1)
    }
  })

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('⚠️ Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)
