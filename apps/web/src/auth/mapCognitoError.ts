type CognitoLikeError = {
  code?: string;
  message?: string;
  name?: string;
};

function errorCode(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const e = err as CognitoLikeError;
  return (e.code ?? e.name ?? '').toString();
}

export function mapCognitoError(err: unknown): string {
  switch (errorCode(err)) {
    case 'UserNotConfirmedException':
      return 'Confirm your email before signing in.';
    case 'NotAuthorizedException':
    case 'InvalidPasswordException':
      return 'Incorrect email or password.';
    case 'UsernameExistsException':
      return 'An account with this email already exists.';
    case 'CodeMismatchException':
      return 'Invalid verification code.';
    case 'ExpiredCodeException':
      return 'Verification code expired. Request a new one.';
    case 'InvalidParameterException':
      return 'Check your input and try again.';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return 'Too many attempts. Please wait and try again.';
    case 'NEW_PASSWORD_REQUIRED':
      return 'Password change is required. Contact support.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function isUserNotConfirmed(err: unknown): boolean {
  return errorCode(err) === 'UserNotConfirmedException';
}
