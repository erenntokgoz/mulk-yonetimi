# Yerel SQL Server yedekleme ve geri yükleme tatbikatı

13 Kasım 2026'da yerel Compose SQL Server'ında ayrı kaynak ve hedef veritabanlarıyla doğrulandı. `BACKUP` ve `RESTORE` 362 sayfa işledi. `RESTORE VERIFYONLY`, iki satır ve 20001.00 toplam kontrolü ile `DBCC CHECKDB` geçti. Geçici veritabanları ve yedek silindi.

Repo kökünde Compose SQL Server sağlıklıyken çalıştırın. SQL aracı parolayı konteyner ortamından alır. Her koşu benzersiz kaynak ve hedef adları üretir.

```powershell
$id = [guid]::NewGuid().ToString('N')
$source = "MulkBackupSource_$id"
$target = "MulkBackupRestore_$id"
$sql = @"
CREATE DATABASE [$source];
GO
USE [$source];
CREATE TABLE dbo.RestoreProbe (Id int NOT NULL PRIMARY KEY, Amount decimal(19,2) NOT NULL);
INSERT dbo.RestoreProbe VALUES (1, 12000.25), (2, 8000.75);
GO
USE master;
BACKUP DATABASE [$source] TO DISK = N'/var/opt/mssql/data/$source.bak' WITH COPY_ONLY, CHECKSUM;
RESTORE VERIFYONLY FROM DISK = N'/var/opt/mssql/data/$source.bak' WITH CHECKSUM;
RESTORE DATABASE [$target] FROM DISK = N'/var/opt/mssql/data/$source.bak' WITH CHECKSUM,
 MOVE N'$source' TO N'/var/opt/mssql/data/$target.mdf',
 MOVE N'${source}_log' TO N'/var/opt/mssql/data/${target}_log.ldf';
GO
USE [$target];
IF (SELECT COUNT(*) FROM dbo.RestoreProbe) <> 2 OR (SELECT SUM(Amount) FROM dbo.RestoreProbe) <> 20001.00
 THROW 50000, 'Restore probe mismatch', 1;
DBCC CHECKDB ([$target]) WITH NO_INFOMSGS;
SELECT 'Restore probe passed' AS Result;
GO
USE master;
DROP DATABASE [$target], [$source];
GO
"@
$sql | docker exec -i mulk-yonetimi-sqlserver bash -c 'export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"; exec /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b'
if ($LASTEXITCODE) { throw 'Tatbikat başarısız. İnceleme için geçici dosyalar saklandı.' }
docker exec mulk-yonetimi-sqlserver rm -- "/var/opt/mssql/data/$source.bak"
```

Üretim verisinin yedeklenmesi, SQL hacmi dışında saklama ve ayrı ortamda geri yükleme kabulü ayrıca doğrulanacak.
