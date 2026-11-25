import { ArgumentsHost, PayloadTooLargeException } from '@nestjs/common';
import { FileTooLargeFilter } from './file-too-large.filter';

describe('FileTooLargeFilter', () => {
  it("replaces multer's English 'File too large' with the endpoint's limit", () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new FileTooLargeFilter(25 * 1024 * 1024).catch(
      new PayloadTooLargeException('File too large'),
      host,
    );

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      statusCode: 413,
      error: 'Payload Too Large',
      message: 'Dosya en fazla 25 MB olabilir',
      maxBytes: 25 * 1024 * 1024,
    });
  });
});
