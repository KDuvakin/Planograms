BEGIN TRY

BEGIN TRAN;

-- AlterTable: mirroring moved from Store to Planogram (differs per Node, not per store)
ALTER TABLE [dbo].[Store] DROP CONSTRAINT [Store_mirrored_df];
ALTER TABLE [dbo].[Store] DROP COLUMN [mirrored];

ALTER TABLE [dbo].[Planogram] ADD [mirrored] BIT NOT NULL CONSTRAINT [Planogram_mirrored_df] DEFAULT 0;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
