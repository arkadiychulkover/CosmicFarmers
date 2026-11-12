import { CROP_CLASSES } from './features.js';
import { RotationMatrix } from './RotationMatrix.js';
import { ROTATION_MATRIX } from './rotationData.js';
import { CropRecommendationService } from './CropRecommendationService.js';
import { cropModel } from './modelStore.js';

export { cropModel, modelStatus, preloadCropModel } from './modelStore.js';
export { CropRecommendationService } from './CropRecommendationService.js';
export { RotationMatrix } from './RotationMatrix.js';

/**
 * Composition root. repository - реализация LastRequestRepository (localStorage-слой).
 * @param {import('./types.js').LastRequestRepository} repository
 */
export function createCropService(repository) {
    return new CropRecommendationService({
        model: cropModel,
        repository,
        rotation: new RotationMatrix(CROP_CLASSES, ROTATION_MATRIX),
    });
}
