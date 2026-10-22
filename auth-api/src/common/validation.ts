import { BadRequestException, ValidationError } from '@nestjs/common';

/** Turns class-validator errors into one plain list of friendly messages:
 *  { statusCode: 400, message: ["Enter your name.", ...], error: "Bad Request" } */
export function validationErrors(errors: ValidationError[]): BadRequestException {
  const messages: string[] = [];
  const walk = (list: ValidationError[]) => {
    for (const e of list) {
      if (e.constraints) {
        for (const m of Object.values(e.constraints)) {
          if (!messages.includes(m)) messages.push(m);
        }
      }
      if (e.children?.length) walk(e.children);
    }
  };
  walk(errors);
  return new BadRequestException(messages.length ? messages : ['Check the details and try again.']);
}
