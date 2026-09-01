/**
 * Cliente Prisma compartido — una sola instancia para toda la app.
 * Antes cada archivo de rutas hacía `new PrismaClient()` propio,
 * lo que abre un pool de conexiones distinto por módulo.
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
