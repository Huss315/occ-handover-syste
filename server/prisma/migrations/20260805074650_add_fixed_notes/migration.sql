-- CreateTable
CREATE TABLE "fixed_notes" (
    "id" SERIAL NOT NULL,
    "note_text" TEXT NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixed_notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fixed_notes" ADD CONSTRAINT "fixed_notes_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_notes" ADD CONSTRAINT "fixed_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
