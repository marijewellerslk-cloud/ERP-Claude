import { Request, Response, NextFunction } from 'express';
import * as storesService from './stores.service.js';
import { CreateStoreInput, UpdateStoreInput } from './stores.validation.js';

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, isActive, parentStoreId } = req.query;

    const filters = {
      search: search as string | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      parentStoreId: parentStoreId === 'null' ? null : (parentStoreId as string | undefined),
    };

    const stores = await storesService.getAllStores(filters);

    res.json({
      success: true,
      data: stores,
    });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const store = await storesService.getStoreById(id);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Store not found',
        },
      });
    }

    res.json({
      success: true,
      data: store,
    });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateStoreInput = req.body;
    const store = await storesService.createStore(data);

    res.status(201).json({
      success: true,
      data: store,
    });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE',
          message: error.message,
        },
      });
    }
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data: UpdateStoreInput = req.body;
    const store = await storesService.updateStore(id, data);

    res.json({
      success: true,
      data: store,
    });
  } catch (error: any) {
    if (error.message === 'Store not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
    }
    if (error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE',
          message: error.message,
        },
      });
    }
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const store = await storesService.deleteStore(id);

    res.json({
      success: true,
      data: store,
      message: 'Store deactivated successfully',
    });
  } catch (error: any) {
    if (error.message === 'Store not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
    }
    if (error.message.includes('child stores')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_CHILDREN',
          message: error.message,
        },
      });
    }
    next(error);
  }
}

export async function getHierarchy(req: Request, res: Response, next: NextFunction) {
  try {
    const hierarchy = await storesService.getStoreHierarchy();

    res.json({
      success: true,
      data: hierarchy,
    });
  } catch (error) {
    next(error);
  }
}
