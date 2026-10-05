import { SetMetadata } from '@nestjs/common';

export const SkipSubscription = () => SetMetadata('skipSubscription', true);
