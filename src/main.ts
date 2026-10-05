import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { writeFileSync } from 'fs';
import { PermissionGuard } from './common/guards/permission.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //versioning
  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.setGlobalPrefix('api');

  // --- Swagger Setup ---
  const config = new DocumentBuilder()
    .setTitle('F-POS API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  writeFileSync('./swagger.json', JSON.stringify(document, null, 2));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const reflector = app.get(Reflector);
  app.useGlobalGuards(
    new JwtAuthGuard(reflector), 
    new RolesGuard(reflector),
    new PermissionGuard(reflector),
  );
  app.enableCors({
    origin: ['http://localhost:3000', 'http://192.168.1.45:3000'],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();
