-- CreateTable
CREATE TABLE "router_sessions" (
    "id" TEXT NOT NULL,
    "router_ip" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "cookies" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "router_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "router_sessions_router_ip_idx" ON "router_sessions"("router_ip");

-- CreateIndex
CREATE INDEX "router_sessions_expires_at_idx" ON "router_sessions"("expires_at");
