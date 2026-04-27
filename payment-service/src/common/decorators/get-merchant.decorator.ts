import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetMerchant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.merchant;
  },
);
