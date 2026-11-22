/** Localize native browser constraint messages even when the browser uses English. */
export function installArabicFormValidation(root: Document) {
  const isField = (
    target: EventTarget | null,
  ): target is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement;
  const onInvalid = (event: Event) => {
    if (!isField(event.target)) return;
    const field = event.target;
    if (field.validity.customError) return;
    const message = field.validity.valueMissing
      ? "يُرجى إكمال هذا الحقل."
      : field.validity.typeMismatch
        ? field instanceof HTMLInputElement && field.type === "email"
          ? "أدخل بريدًا إلكترونيًّا صالحًا."
          : "أدخل رابطًا صالحًا."
        : field.validity.rangeUnderflow || field.validity.rangeOverflow
          ? "القيمة خارج النطاق المسموح. تحقّق من بداية الآيات ونهايتها."
          : field.validity.tooShort
            ? "القيمة أقصر من الحدّ المطلوب. كلمة المرور تحتاج إلى ٨ أحرف على الأقل."
            : field.validity.stepMismatch || field.validity.badInput
              ? "أدخل عددًا صحيحًا صالحًا."
              : "تحقّق من قيمة هذا الحقل ثم حاول مجددًا.";
    field.setCustomValidity(message);
  };
  const clear = (event: Event) => {
    if (isField(event.target)) event.target.setCustomValidity("");
  };
  root.addEventListener("invalid", onInvalid, true);
  root.addEventListener("input", clear);
  root.addEventListener("change", clear);
  return () => {
    root.removeEventListener("invalid", onInvalid, true);
    root.removeEventListener("input", clear);
    root.removeEventListener("change", clear);
  };
}
