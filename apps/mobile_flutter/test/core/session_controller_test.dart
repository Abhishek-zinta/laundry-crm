import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rinseops/core/auth/auth_repository.dart';
import 'package:rinseops/core/auth/session_controller.dart';
import 'package:rinseops/core/auth/session_models.dart';
import 'package:rinseops/core/domain/enums.dart';
import 'package:rinseops/core/errors/app_exception.dart';

Session _session() => Session.fromJson(jsonDecode(File('test/fixtures/me.json').readAsStringSync()) as Map<String, dynamic>);

class FakeAuthRepository implements AuthRepository {
  bool stored = false;
  Object? meError;
  Object? loginError;
  int logouts = 0;
  final expired = StreamController<void>.broadcast();

  @override
  Future<bool> hasCredentials() async => stored;

  @override
  Future<void> login(String email, String password) async {
    if (loginError != null) throw loginError!;
    stored = true;
  }

  @override
  Future<Session> me() async {
    if (meError != null) throw meError!;
    return _session();
  }

  @override
  Future<void> logout() async {
    logouts++;
    stored = false;
  }

  @override
  Stream<void> get sessionExpired => expired.stream;
}

void main() {
  late FakeAuthRepository repo;
  late ProviderContainer container;

  Future<AuthState> settled() async {
    for (var i = 0; i < 20 && container.read(sessionControllerProvider) is AuthRestoring; i++) {
      await Future<void>.delayed(Duration.zero);
    }
    return container.read(sessionControllerProvider);
  }

  setUp(() {
    repo = FakeAuthRepository();
    container = ProviderContainer(overrides: [authRepositoryProvider.overrideWithValue(repo)], retry: (_, _) => null);
    addTearDown(container.dispose);
  });

  test('starts restoring, then signed out when no credentials are stored', () async {
    expect(container.read(sessionControllerProvider), isA<AuthRestoring>());
    expect(await settled(), isA<AuthSignedOut>());
  });

  test('restores a stored session', () async {
    repo.stored = true;
    container.read(sessionControllerProvider);
    final state = await settled();
    expect(state, isA<AuthSignedIn>());
    final session = (state as AuthSignedIn).session;
    expect(session.user.role, Role.owner);
    expect(session.can(Perm.dashboardView), isTrue);
    expect(container.read(sessionProvider).tenant.settings.currency, 'INR');
  });

  test('a rejected stored session signs out and clears credentials', () async {
    repo
      ..stored = true
      ..meError = const AppException('expired', code: 'UNAUTHORIZED', statusCode: 401);
    container.read(sessionControllerProvider);
    final state = await settled();
    expect(state, isA<AuthSignedOut>());
    expect((state as AuthSignedOut).message, contains('expired'));
    expect(repo.logouts, 1);
  });

  test('offline at startup keeps credentials and offers retry', () async {
    repo
      ..stored = true
      ..meError = const AppException('offline', code: 'NETWORK');
    container.read(sessionControllerProvider);
    expect(await settled(), isA<AuthOffline>());
    expect(repo.logouts, 0);
    expect(repo.stored, isTrue);

    repo.meError = null;
    await container.read(sessionControllerProvider.notifier).restore();
    expect(container.read(sessionControllerProvider), isA<AuthSignedIn>());
  });

  test('login success and failure', () async {
    container.read(sessionControllerProvider);
    await settled();
    final controller = container.read(sessionControllerProvider.notifier);

    repo.loginError = const AppException('Incorrect email or password.', code: 'INVALID_CREDENTIALS', statusCode: 401);
    await expectLater(controller.login('x@y.z', 'bad'), throwsA(isA<AppException>()));
    expect(container.read(sessionControllerProvider), isA<AuthSignedOut>());

    repo.loginError = null;
    await controller.login('owner@freshfold.test', 'good');
    expect(container.read(sessionControllerProvider), isA<AuthSignedIn>());
  });

  test('logout and server-side expiry both sign out', () async {
    repo.stored = true;
    container.read(sessionControllerProvider);
    await settled();
    await container.read(sessionControllerProvider.notifier).logout();
    expect(container.read(sessionControllerProvider), isA<AuthSignedOut>());
    expect(repo.logouts, 1);

    await container.read(sessionControllerProvider.notifier).login('a@b.c', 'p');
    expect(container.read(sessionControllerProvider), isA<AuthSignedIn>());
    repo.expired.add(null);
    await Future<void>.delayed(Duration.zero);
    expect(container.read(sessionControllerProvider), isA<AuthSignedOut>());
  });
}
