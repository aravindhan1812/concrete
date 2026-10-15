import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { EntityAccessService } from '../../common/entity-access/entity-access.service';
import { AuthUser } from '../../common/types';
import { FileRecord } from '../../entities/shared.entities';
import { StorageService } from './storage.service';

export const MAX_FILE_BYTES = 100 * 1024 * 1024; // drawings can be large; photos are far smaller

/** What can be uploaded: images (site photos, bills), PDFs (drawings, invoices), CAD, office docs, video. */
const ALLOWED = [
  /^image\/(jpeg|png|webp|heic|heif|gif)$/,
  /^application\/pdf$/,
  /^video\/(mp4|quicktime|webm)$/,
  /^application\/(acad|dxf|x-dwg|x-autocad|vnd\.dwg|dwg)$/,
  /^image\/vnd\.dwg$/,
  /^application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document|presentationml\.presentation)$/,
  /^application\/(vnd\.ms-excel|msword)$/,
  /^text\/(csv|plain)$/,
  /^application\/zip$/,
];

export function isAllowedMime(mime: string) {
  return ALLOWED.some((re) => re.test(mime));
}

/** Keeps letters, digits, dot, dash, underscore; collapses the rest. Never empty. */
export function safeFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^\.+/, '').slice(-120);
  return cleaned || 'file';
}

export interface CreateUploadInput {
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  gpsLat?: number;
  gpsLng?: number;
  capturedAt?: string;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly access: EntityAccessService,
  ) {}

  /** Step 1: reserve a file row and hand back a short-lived presigned PUT URL. */
  async createUpload(user: AuthUser, input: CreateUploadInput) {
    await this.access.assertAccess(user, input.entityType, input.entityId);
    if (!isAllowedMime(input.mimeType)) throw new BadRequestException(`File type ${input.mimeType} is not allowed`);
    if (!(input.sizeBytes > 0) || input.sizeBytes > MAX_FILE_BYTES) throw new BadRequestException(`File must be between 1 byte and ${MAX_FILE_BYTES / 1024 / 1024} MB`);
    if ((input.gpsLat == null) !== (input.gpsLng == null)) throw new BadRequestException('gpsLat and gpsLng go together');

    const name = safeFileName(input.fileName);
    const key = `${user.companyId}/${input.entityType}/${input.entityId}/${randomUUID()}/${name}`;
    const repo = this.dataSource.getRepository(FileRecord);
    const file = await repo.save(
      repo.create({
        companyId: user.companyId,
        uploadedBy: user.userId,
        storageKey: key,
        fileName: (input.fileName.split(/[\\/]/).pop() || 'file').slice(0, 255), // display name: no directory parts
        mimeType: input.mimeType,
        sizeBytes: String(input.sizeBytes),
        entityType: input.entityType,
        entityId: input.entityId,
        gpsLat: input.gpsLat != null ? String(input.gpsLat) : null,
        gpsLng: input.gpsLng != null ? String(input.gpsLng) : null,
        capturedAt: input.capturedAt ? new Date(input.capturedAt) : null,
        status: 'pending',
      }),
    );
    const uploadUrl = await this.storage.uploadUrl(key, input.mimeType);
    return { file: this.view(file), upload: { url: uploadUrl, method: 'PUT', headers: { 'Content-Type': input.mimeType }, expiresIn: 900 } };
  }

  /** Step 2: confirm the object landed; record its real size. */
  async complete(user: AuthUser, id: string) {
    const file = await this.load(user, id, ['pending', 'ready']);
    if (file.status === 'ready') return this.view(file);
    const head = await this.storage.head(file.storageKey);
    if (!head) throw new BadRequestException('Upload not found in storage yet — PUT the file to the upload URL first');
    if (head.size > MAX_FILE_BYTES) throw new BadRequestException('Uploaded file exceeds the size limit');
    file.sizeBytes = String(head.size);
    file.status = 'ready';
    await this.dataSource.getRepository(FileRecord).save(file);
    return this.view(file);
  }

  async listForEntity(user: AuthUser, entityType: string, entityId: string) {
    await this.access.assertAccess(user, entityType, entityId);
    const files = await this.dataSource.getRepository(FileRecord).find({
      where: { companyId: user.companyId, entityType, entityId, status: 'ready' },
      order: { createdAt: 'DESC' },
    });
    return files.map((f) => this.view(f));
  }

  async downloadUrl(user: AuthUser, id: string, inline: boolean) {
    const file = await this.load(user, id, ['ready']);
    return { url: await this.storage.downloadUrl(file.storageKey, file.fileName, { inline }), expiresIn: 300 };
  }

  /** Soft delete: the row disappears from lists; the object is purged by a later lifecycle job. */
  async remove(user: AuthUser, id: string) {
    const file = await this.load(user, id, ['pending', 'ready']);
    file.status = 'deleted';
    file.deletedAt = new Date();
    await this.dataSource.getRepository(FileRecord).save(file);
    return { ok: true };
  }

  private async load(user: AuthUser, id: string, statuses: FileRecord['status'][]) {
    const file = await this.dataSource.getRepository(FileRecord).findOne({ where: { id, companyId: user.companyId } });
    if (!file || !statuses.includes(file.status)) throw new NotFoundException('File not found');
    if (file.entityType && file.entityId) await this.access.assertAccess(user, file.entityType, file.entityId);
    return file;
  }

  private view(f: FileRecord) {
    return {
      id: f.id,
      fileName: f.fileName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes != null ? Number(f.sizeBytes) : null,
      entityType: f.entityType,
      entityId: f.entityId,
      gpsLat: f.gpsLat != null ? Number(f.gpsLat) : null,
      gpsLng: f.gpsLng != null ? Number(f.gpsLng) : null,
      capturedAt: f.capturedAt,
      status: f.status,
      uploadedBy: f.uploadedBy,
      createdAt: f.createdAt,
    };
  }
}
