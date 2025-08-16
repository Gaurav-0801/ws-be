"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WS_PORT = exports.DATABASE_URL = exports.JWT_SECRET = void 0;
exports.JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-here";
exports.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/excalidraw";
exports.WS_PORT = process.env.WS_PORT ? Number.parseInt(process.env.WS_PORT) : 8080;
//# sourceMappingURL=config.js.map