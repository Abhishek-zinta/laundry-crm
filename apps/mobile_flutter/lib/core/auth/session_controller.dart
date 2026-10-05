import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../errors/app_exception.dart';
import '../format/business_time.dart';
import 'auth_repository.dart';
import 'session_models.dart';

sealed class AuthState {
  const AuthState();
}

/// Restoring a stored session at startup.
class AuthRestoring extends AuthState {
  const AuthRestoring();
}

class AuthSignedOut extends AuthState {
  const AuthSignedOut({this.message});

  /// Shown on the login screen, e.g. "Your session has expired".
  final String? message;
}

class AuthSignedIn extends AuthState {
  const AuthSignedIn(this.session);
  final Session session;
}

/// Stored credentials exist but the server couldn't be reached to verify them.
class AuthOffline extends AuthState {
  const AuthOffline(this.error);
  final AppException error;
}

final sessionControllerProvider = NotifierProvider<SessionController, AuthState>(SessionController.new);

/// The signed-in session, for widgets below the auth gate. After sign-out it
/// briefly keeps the last session so screens being torn down by the router
/// redirect don't fail mid-transition.
final sessionProvider = Provider<Session>((ref) {
  final state = ref.watch(sessionControllerProvider);
  if (state is AuthSignedIn) return state.session;
  final last = ref.read(sessionControllerProvider.notifier).lastSession;
  if (last != null) return last;
  throw StateError('No signed-in session');
});

class SessionController extends Notifier<AuthState> {
  StreamSubscription<void>? _expiredSub;

  /// Most recent signed-in session (see [sessionProvider]).
  Session? lastSession;

  @override
  set state(AuthState value) {
    if (value is AuthSignedIn) {
      lastSession = value.session;
      BusinessTime.use(value.session.tenant.settings.timezone);
    }
    super.state = value;
  }

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  AuthState build() {
    _expiredSub = ref.watch(authRepositoryProvider).sessionExpired.listen((_) {
      state = const AuthSignedOut(message: 'Your session has expired. Please sign in again.');
    });
    ref.onDispose(() => _expiredSub?.cancel());
    Future.microtask(restore);
    return const AuthRestoring();
  }

  /// Splash: resume the stored session if the server still accepts it.
  Future<void> restore() async {
    state = const AuthRestoring();
    if (!await _repo.hasCredentials()) {
      state = const AuthSignedOut();
      return;
    }
    try {
      state = AuthSignedIn(await _repo.me());
    } on AppException catch (e) {
      if (e.isNetwork) {
        state = AuthOffline(e);
      } else if (e.isUnauthorized) {
        await _repo.logout();
        state = const AuthSignedOut(message: 'Your session has expired. Please sign in again.');
      } else {
        state = AuthOffline(e);
      }
    }
  }

  /// Throws [AppException] with a user-facing message on failure.
  Future<void> login(String email, String password) async {
    await _repo.login(email, password);
    try {
      state = AuthSignedIn(await _repo.me());
    } on AppException {
      await _repo.logout();
      rethrow;
    }
  }

  Future<void> refreshSession() async {
    try {
      state = AuthSignedIn(await _repo.me());
    } on AppException {
      // Keep the current session; screens surface their own errors.
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const AuthSignedOut();
  }
}
