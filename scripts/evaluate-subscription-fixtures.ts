import { OFFLINE_SUBSCRIPTION_FIXTURES } from "@/lib/evaluation/offline-subscription-fixtures";
import { evaluateSubscriptionFixtures } from "@/lib/evaluation/subscription-evaluation";

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

const result = evaluateSubscriptionFixtures(OFFLINE_SUBSCRIPTION_FIXTURES);

console.log("Offline subscription evaluation");
console.log("=============================");
console.log(`Fixtures: ${result.fixtureCount}`);
console.log(`TP: ${result.truePositives}  FP: ${result.falsePositives}  FN: ${result.falseNegatives}`);
console.log(`Precision: ${formatPercent(result.precision)}`);
console.log(`Recall: ${formatPercent(result.recall)}`);
console.log(`F1: ${formatPercent(result.f1Score)}`);

if (result.errors.length > 0) {
  console.log("\nMisclassifications:");
  for (const error of result.errors) {
    console.log(`- ${error.fixtureId}: ${error.kind} (${error.merchantNormalized})`);
  }
}
