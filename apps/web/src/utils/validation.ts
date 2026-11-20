import { VALIDATION_LIMITS } from "../constants/task";
import type { FormErrors } from "../types/task";

export interface ValidateTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateTaskInput(input: ValidateTaskInput): FormErrors {
  const errors: FormErrors = {};
  const trimmedTitle = input.title.trim();
  const trimmedDescription = input.description?.trim() ?? "";

  if (!trimmedTitle) {
    errors.title = "Không được bỏ trống tiêu đề.";
  } else if (trimmedTitle.length < VALIDATION_LIMITS.TITLE_MIN) {
    errors.title = `Tiêu đề phải có ít nhất ${VALIDATION_LIMITS.TITLE_MIN} ký tự.`;
  } else if (trimmedTitle.length > VALIDATION_LIMITS.TITLE_MAX) {
    errors.title = `Tiêu đề tối đa ${VALIDATION_LIMITS.TITLE_MAX} ký tự.`;
  }

  if (trimmedDescription.length > VALIDATION_LIMITS.DESCRIPTION_MAX) {
    errors.description = `Mô tả tối đa ${VALIDATION_LIMITS.DESCRIPTION_MAX} ký tự.`;
  }

  if (input.dueDate && !ISO_DATE_REGEX.test(input.dueDate)) {
    errors.dueDate = "Ngày hết hạn không hợp lệ.";
  }

  return errors;
}

export function hasFormErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}
