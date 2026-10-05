import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rinseops/core/widgets/dialogs.dart';

void main() {
  // Regression: the dialog's controller used to be disposed as soon as the
  // dialog returned, while the route was still animating out. The keyboard
  // closing during that animation rebuilt the TextField with a disposed
  // controller and crashed (seen when a driver marked a task as failed).
  testWidgets('askText survives a rebuild while it animates out', (tester) async {
    String? result;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async => result = await askText(context, title: 'Why?', label: 'Reason', action: 'Mark failed', minLength: 3),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    tester.view.viewInsets = const FakeViewPadding(bottom: 800); // keyboard open
    addTearDown(tester.view.resetViewInsets);

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull, reason: 'disabled until minLength');

    await tester.enterText(find.byType(TextField), 'Customer not home');
    await tester.pump();
    await tester.tap(find.text('Mark failed'));
    await tester.pump(); // dialog starts closing
    tester.view.viewInsets = FakeViewPadding.zero; // keyboard hides mid-animation
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(result, 'Customer not home');
    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets('askText returns null when cancelled', (tester) async {
    String? result = 'unset';
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () async => result = await askText(context, title: 'Tag', label: 'Tag', action: 'Find', cancel: 'Cancel'),
            child: const Text('open'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(result, isNull);
  });
}
