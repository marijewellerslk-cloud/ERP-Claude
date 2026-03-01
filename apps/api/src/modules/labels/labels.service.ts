import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { labelTemplates } from '../../db/schema.js';
import {
  CreateLabelTemplateInput,
  UpdateLabelTemplateInput,
} from './labels.validation.js';

export class LabelsService {
  // Create a new label template
  async createTemplate(
    input: CreateLabelTemplateInput,
    storeId: string,
    userId: string
  ) {
    // If this template is set as default, unset any existing default templates
    if (input.isDefault) {
      await db
        .update(labelTemplates)
        .set({ isDefault: false })
        .where(
          and(eq(labelTemplates.storeId, storeId), eq(labelTemplates.isDefault, true))
        );
    }

    const [template] = await db
      .insert(labelTemplates)
      .values({
        ...input,
        storeId,
        createdBy: userId,
      })
      .returning();

    return template;
  }

  // Get all label templates for a store
  async listTemplates(storeId: string, includeInactive = false) {
    const conditions = [eq(labelTemplates.storeId, storeId)];

    if (!includeInactive) {
      conditions.push(eq(labelTemplates.isActive, true));
    }

    const templates = await db
      .select()
      .from(labelTemplates)
      .where(and(...conditions))
      .orderBy(desc(labelTemplates.isDefault), desc(labelTemplates.createdAt));

    return templates;
  }

  // Get a single label template
  async getTemplate(templateId: string, storeId: string) {
    const [template] = await db
      .select()
      .from(labelTemplates)
      .where(
        and(
          eq(labelTemplates.id, templateId),
          eq(labelTemplates.storeId, storeId)
        )
      );

    if (!template) {
      throw new Error('Label template not found');
    }

    return template;
  }

  // Get the default template for a store
  async getDefaultTemplate(storeId: string) {
    const [template] = await db
      .select()
      .from(labelTemplates)
      .where(
        and(
          eq(labelTemplates.storeId, storeId),
          eq(labelTemplates.isDefault, true),
          eq(labelTemplates.isActive, true)
        )
      );

    // If no default template exists, return the first active template
    if (!template) {
      const [firstTemplate] = await db
        .select()
        .from(labelTemplates)
        .where(
          and(
            eq(labelTemplates.storeId, storeId),
            eq(labelTemplates.isActive, true)
          )
        )
        .orderBy(desc(labelTemplates.createdAt))
        .limit(1);

      return firstTemplate || null;
    }

    return template;
  }

  // Update a label template
  async updateTemplate(
    templateId: string,
    storeId: string,
    input: UpdateLabelTemplateInput,
    userId: string
  ) {
    // Check if template exists
    await this.getTemplate(templateId, storeId);

    // If setting as default, unset other default templates
    if (input.isDefault) {
      await db
        .update(labelTemplates)
        .set({ isDefault: false })
        .where(
          and(eq(labelTemplates.storeId, storeId), eq(labelTemplates.isDefault, true))
        );
    }

    const [updated] = await db
      .update(labelTemplates)
      .set({
        ...input,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(labelTemplates.id, templateId),
          eq(labelTemplates.storeId, storeId)
        )
      )
      .returning();

    return updated;
  }

  // Delete a label template (soft delete by marking inactive)
  async deleteTemplate(templateId: string, storeId: string) {
    const template = await this.getTemplate(templateId, storeId);

    if (template.isDefault) {
      throw new Error('Cannot delete the default template. Set another template as default first.');
    }

    const [deleted] = await db
      .update(labelTemplates)
      .set({ isActive: false })
      .where(
        and(
          eq(labelTemplates.id, templateId),
          eq(labelTemplates.storeId, storeId)
        )
      )
      .returning();

    return deleted;
  }

  // Set a template as default
  async setDefaultTemplate(templateId: string, storeId: string) {
    // Check if template exists
    await this.getTemplate(templateId, storeId);

    // Unset all existing default templates
    await db
      .update(labelTemplates)
      .set({ isDefault: false })
      .where(
        and(eq(labelTemplates.storeId, storeId), eq(labelTemplates.isDefault, true))
      );

    // Set this template as default
    const [updated] = await db
      .update(labelTemplates)
      .set({ isDefault: true, isActive: true })
      .where(
        and(
          eq(labelTemplates.id, templateId),
          eq(labelTemplates.storeId, storeId)
        )
      )
      .returning();

    return updated;
  }

  // Duplicate a template
  async duplicateTemplate(
    templateId: string,
    storeId: string,
    userId: string,
    newName?: string
  ) {
    const original = await this.getTemplate(templateId, storeId);

    const [duplicated] = await db
      .insert(labelTemplates)
      .values({
        ...original,
        id: undefined as any,
        name: newName || `${original.name} (Copy)`,
        isDefault: false,
        createdBy: userId,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return duplicated;
  }
}

export const labelsService = new LabelsService();
