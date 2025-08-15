export const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-here"
export const DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/excalidraw"
export const WS_PORT = process.env.WS_PORT ? Number.parseInt(process.env.WS_PORT) : 8080
