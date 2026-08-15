BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000),
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'MERCHANDISER',
    [storeId] NVARCHAR(1000),
    [active] BIT NOT NULL CONSTRAINT [User_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Store] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000),
    [chain] NVARCHAR(1000),
    [format] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Store_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Store_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Store_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Printer] (
    [id] NVARCHAR(1000) NOT NULL,
    [storeId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000),
    [ip] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Printer_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Printer_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Planogram] (
    [id] NVARCHAR(1000) NOT NULL,
    [storeId] NVARCHAR(1000) NOT NULL,
    [node] NVARCHAR(1000) NOT NULL,
    [version] INT NOT NULL CONSTRAINT [Planogram_version_df] DEFAULT 1,
    [isCurrent] BIT NOT NULL CONSTRAINT [Planogram_isCurrent_df] DEFAULT 1,
    [shelfLengthCm] FLOAT(53) NOT NULL CONSTRAINT [Planogram_shelfLengthCm_df] DEFAULT 133,
    [sourceFileName] NVARCHAR(1000) NOT NULL,
    [importedAt] DATETIME2 NOT NULL CONSTRAINT [Planogram_importedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [importedById] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Planogram_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Planogram_storeId_node_version_key] UNIQUE NONCLUSTERED ([storeId],[node],[version])
);

-- CreateTable
CREATE TABLE [dbo].[PlanogramItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [planogramId] NVARCHAR(1000) NOT NULL,
    [sortIndex] INT NOT NULL,
    [sap] NVARCHAR(1000) NOT NULL,
    [ean] NVARCHAR(1000),
    [article] NVARCHAR(1000) NOT NULL,
    [rackOld] NVARCHAR(1000) NOT NULL,
    [shelfOld] NVARCHAR(1000) NOT NULL,
    [positionNumberOld] NVARCHAR(1000) NOT NULL,
    [facesOld] INT NOT NULL,
    [unitOrTrayOld] NVARCHAR(1000),
    [positionWidthOld] FLOAT(53),
    [productTrayWidthOld] FLOAT(53),
    [rackNew] NVARCHAR(1000) NOT NULL,
    [shelfNew] NVARCHAR(1000) NOT NULL,
    [positionNumberNew] NVARCHAR(1000) NOT NULL,
    [facesNew] INT NOT NULL,
    [unitOrTrayNew] NVARCHAR(1000),
    [positionWidthNew] FLOAT(53),
    [productTrayWidthNew] FLOAT(53),
    [faceWidth] FLOAT(53) NOT NULL,
    [isNew] BIT NOT NULL,
    [isDeleted] BIT NOT NULL,
    CONSTRAINT [PlanogramItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PlanogramRun] (
    [id] NVARCHAR(1000) NOT NULL,
    [planogramId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [PlanogramRun_status_df] DEFAULT 'NOT_STARTED',
    [currentRealStep] INT NOT NULL CONSTRAINT [PlanogramRun_currentRealStep_df] DEFAULT 0,
    [realStepsTotal] INT NOT NULL CONSTRAINT [PlanogramRun_realStepsTotal_df] DEFAULT 0,
    [startedAt] DATETIME2,
    [finishedAt] DATETIME2,
    [lastActivityAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PlanogramRun_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PlanogramRun_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Feedback] (
    [id] NVARCHAR(1000) NOT NULL,
    [runId] NVARCHAR(1000) NOT NULL,
    [planogramItemId] NVARCHAR(1000),
    [stepRealIndex] INT NOT NULL,
    [comment] NVARCHAR(max) NOT NULL,
    [photoUrl] NVARCHAR(1000),
    [userId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Feedback_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Feedback_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Printer_storeId_idx] ON [dbo].[Printer]([storeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Planogram_storeId_node_isCurrent_idx] ON [dbo].[Planogram]([storeId], [node], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PlanogramItem_planogramId_sap_idx] ON [dbo].[PlanogramItem]([planogramId], [sap]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PlanogramRun_planogramId_userId_status_idx] ON [dbo].[PlanogramRun]([planogramId], [userId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PlanogramRun_userId_status_idx] ON [dbo].[PlanogramRun]([userId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Feedback_runId_idx] ON [dbo].[Feedback]([runId]);

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_storeId_fkey] FOREIGN KEY ([storeId]) REFERENCES [dbo].[Store]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Printer] ADD CONSTRAINT [Printer_storeId_fkey] FOREIGN KEY ([storeId]) REFERENCES [dbo].[Store]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Planogram] ADD CONSTRAINT [Planogram_storeId_fkey] FOREIGN KEY ([storeId]) REFERENCES [dbo].[Store]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Planogram] ADD CONSTRAINT [Planogram_importedById_fkey] FOREIGN KEY ([importedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PlanogramItem] ADD CONSTRAINT [PlanogramItem_planogramId_fkey] FOREIGN KEY ([planogramId]) REFERENCES [dbo].[Planogram]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PlanogramRun] ADD CONSTRAINT [PlanogramRun_planogramId_fkey] FOREIGN KEY ([planogramId]) REFERENCES [dbo].[Planogram]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PlanogramRun] ADD CONSTRAINT [PlanogramRun_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Feedback] ADD CONSTRAINT [Feedback_runId_fkey] FOREIGN KEY ([runId]) REFERENCES [dbo].[PlanogramRun]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Feedback] ADD CONSTRAINT [Feedback_planogramItemId_fkey] FOREIGN KEY ([planogramItemId]) REFERENCES [dbo].[PlanogramItem]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Feedback] ADD CONSTRAINT [Feedback_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
