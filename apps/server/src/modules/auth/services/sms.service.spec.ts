import { Test, TestingModule } from "@nestjs/testing";

import { BusinessException } from "../../../common/errors/business.exception";
import { ApiErrorCode } from "../../../common/errors/error-codes";
import { REDIS_CLIENT } from "../../../common/redis/redis.module";
import { SmsService } from "./sms.service";

describe("SmsService", () => {
  let service: SmsService;
  let redisClient: jest.Mocked<{
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    pipeline: jest.Mock;
  }>;

  const mockPipeline = {
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const mockRedisClient = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      pipeline: jest.fn().mockReturnValue(mockPipeline),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    redisClient = module.get(REDIS_CLIENT);
  });

  describe("sendCode", () => {
    it("should send code successfully when within rate limits", async () => {
      redisClient.get.mockResolvedValue(null);
      redisClient.setex.mockResolvedValue("OK");

      await expect(service.sendCode("13812345678")).resolves.not.toThrow();

      expect(redisClient.setex).toHaveBeenCalledWith(
        "sms:code:13812345678",
        300,
        expect.any(String),
      );
    });

    it("should throw AUTH_PHONE_RATE_LIMITED when minute limit exceeded", async () => {
      redisClient.get.mockResolvedValueOnce("1"); // minute limit exceeded

      try {
        await service.sendCode("13812345678");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).code).toBe(
          ApiErrorCode.AUTH_PHONE_RATE_LIMITED,
        );
      }
    });

    it("should throw AUTH_PHONE_RATE_LIMITED when hour limit exceeded", async () => {
      redisClient.get
        .mockResolvedValueOnce(null) // minute OK
        .mockResolvedValueOnce("10"); // hour limit exceeded

      try {
        await service.sendCode("13812345678");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).code).toBe(
          ApiErrorCode.AUTH_PHONE_RATE_LIMITED,
        );
      }
    });
  });

  describe("verifyCode", () => {
    it("should verify code successfully", async () => {
      redisClient.get.mockResolvedValue("123456");
      redisClient.del.mockResolvedValue(1);

      const result = await service.verifyCode("13812345678", "123456");

      expect(result).toBe(true);
      expect(redisClient.del).toHaveBeenCalledWith("sms:code:13812345678");
    });

    it("should throw AUTH_PHONE_CODE_EXPIRED when code not found", async () => {
      redisClient.get.mockResolvedValue(null);

      try {
        await service.verifyCode("13812345678", "123456");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).code).toBe(
          ApiErrorCode.AUTH_PHONE_CODE_EXPIRED,
        );
      }
    });

    it("should throw AUTH_PHONE_CODE_INVALID when code does not match", async () => {
      redisClient.get.mockResolvedValue("654321");

      try {
        await service.verifyCode("13812345678", "123456");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).code).toBe(
          ApiErrorCode.AUTH_PHONE_CODE_INVALID,
        );
      }
    });
  });
});
