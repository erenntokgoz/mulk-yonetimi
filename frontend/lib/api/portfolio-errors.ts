const quotaMessage = "Birim kotası doldu. Mevcut kayıtları görüntüleyebilirsiniz.";

async function isUnitQuotaConflict(response: Response) {
  if (response.status !== 409) return false;
  try {
    const body = (await response.clone().json()) as { title?: unknown };
    return body.title === "Birim kotası doldu.";
  } catch {
    return false;
  }
}

export async function propertyCreateError(response: Response) {
  if (await isUnitQuotaConflict(response)) return quotaMessage;
  return response.status === 409
    ? "Mülk başka bir işlemde değişti. Güncel sürümü yükleyip tekrar deneyin."
    : "Mülk kaydedilemedi. Bilgileri kontrol edip tekrar deneyin.";
}

export async function unitCreateError(response: Response) {
  if (await isUnitQuotaConflict(response)) return quotaMessage;
  return response.status === 409
    ? "Bu mülke birim eklenemedi."
    : "Birim kaydedilemedi. Bilgileri kontrol edin.";
}
