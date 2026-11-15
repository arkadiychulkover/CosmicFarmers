import { CROP_CLASSES } from './features.js';
import { RotationMatrix } from './RotationMatrix.js';
import { ROTATION_MATRIX } from './rotationData.js';
import { CropRecommendationService } from './CropRecommendationService.js';
import { cropModel } from './modelStore.js';

export { cropModel, modelStatus, preloadCropModel } from './modelStore.js';
export { CropRecommendationService } from './CropRecommendationService.js';
export { RotationMatrix } from './RotationMatrix.js';
export { FEATURE_ORDER, CROP_CLASSES, IRRIGATION_MAP, irrigationToFeature, toFeatureVector } from './features.js';
export { GOAL_WEIGHTS, CROP_WATER_DEMAND, getWaterDemandTier, getGoalMultipliers, getTelemetryMultipliers, goalNote, telemetryNote } from './goalData.js';
export { PERENNIAL_CROPS, isPerennialCrop, ROTATION_MATRIX } from './rotationData.js';
export { assessFieldOod, computeSuitabilityPercent, toSuitabilityPercents } from './scoring.js';
export { computePlanCoverWindows } from './coverCropWindows.js';

export function createCropService(repository, options = {}) {
  return new CropRecommendationService({
    model: cropModel,
    repository,
    rotation: new RotationMatrix(CROP_CLASSES, ROTATION_MATRIX),
    goal: options.goal,
  });
}
