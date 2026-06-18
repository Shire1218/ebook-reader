-- CreateTable
CREATE TABLE "reading_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME NOT NULL,
    "duration" INTEGER NOT NULL,
    "start_page" TEXT,
    "end_page" TEXT,
    "start_chapter" TEXT,
    "end_chapter" TEXT,
    "date" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reading_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reading_sessions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "reading_sessions_user_id_date_idx" ON "reading_sessions"("user_id", "date");

-- CreateIndex
CREATE INDEX "reading_sessions_user_id_book_id_idx" ON "reading_sessions"("user_id", "book_id");
