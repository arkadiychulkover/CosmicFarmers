import { CROP_CLASSES } from './features.js';
import { RotationMatrix } from './RotationMatrix.js';
import { ROTATION_MATRIX } from './rotationData.js';
import { CropRecommendationService } from './CropRecommendationService.js';
import { cropModel } from './modelStore.js';

export { cropModel, modelStatus, preloadCropModel } from './modelStore.js';
export { CropRecommendationService } from './CropRecommendationService.js';
export { RotationMatrix } from './RotationMatrix.js';
export { GOAL_WEIGHTS, getGoalMultipliers, goalNote } from './goalData.js';


export function createCropService(repository, options = {}) {
    return new CropRecommendationService({
        model: cropModel,
        repository,
        rotation: new RotationMatrix(CROP_CLASSES, ROTATION_MATRIX),
        goal: options.goal,
    });
}
