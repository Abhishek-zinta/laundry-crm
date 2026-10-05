import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/domain/enums.dart';
import '../../core/errors/app_exception.dart';
import '../../core/format/formatters.dart';
import '../../core/format/money.dart';
import '../../core/util/ids.dart';
import 'data/payments_repository.dart';

/// Collects a full or partial payment for an order. Returns true when recorded.
Future<bool> showPaymentSheet(BuildContext context, {required String orderId, required String orderNumber, required Money balance}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (_) => _PaymentSheet(orderId: orderId, orderNumber: orderNumber, balance: balance),
  );
  return result ?? false;
}

class _PaymentSheet extends ConsumerStatefulWidget {
  const _PaymentSheet({required this.orderId, required this.orderNumber, required this.balance});
  final String orderId;
  final String orderNumber;
  final Money balance;

  @override
  ConsumerState<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends ConsumerState<_PaymentSheet> {
  late final _amount = TextEditingController(text: widget.balance.toApi());
  final _reference = TextEditingController();
  PaymentMethod _method = PaymentMethod.cash;
  bool _busy = false;
  String? _error;

  /// One key per sheet: a retry after a timeout can't double-charge.
  final _idempotencyKey = newIdempotencyKey('app-pay');

  @override
  void dispose() {
    _amount.dispose();
    _reference.dispose();
    super.dispose();
  }

  Money? get _parsed => Money.tryParse(_amount.text);

  String? _validate() {
    final m = _parsed;
    if (m == null || !m.isPositive) return 'Enter an amount greater than zero';
    if (m > widget.balance) return 'Amount is more than the outstanding balance';
    return null;
  }

  Future<void> _submit() async {
    final problem = _validate();
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(paymentsRepositoryProvider)
          .record(orderId: widget.orderId, amount: _parsed!, method: _method, reference: _reference.text, idempotencyKey: _idempotencyKey);
      if (mounted) Navigator.pop(context, true);
    } on Object catch (e) {
      if (mounted) setState(() => _error = AppException.from(e).message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final money = ref.watch(moneyFormatProvider);
    final theme = Theme.of(context);
    final parsed = _parsed;
    final partial = parsed != null && parsed.isPositive && parsed < widget.balance;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Add payment', style: theme.textTheme.titleLarge),
          Text('${widget.orderNumber} · Outstanding ${money.format(widget.balance)}', style: theme.textTheme.bodyMedium),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final m in PaymentMethod.values)
                ChoiceChip(
                  label: Text(m.label),
                  avatar: Icon(_icon(m), size: 18),
                  selected: _method == m,
                  onSelected: _busy ? null : (_) => setState(() => _method = m),
                ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _amount,
            enabled: !_busy,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
            decoration: InputDecoration(
              labelText: 'Amount',
              helperText: partial ? 'Partial payment · ${money.format(widget.balance - parsed)} will remain' : null,
              suffixIcon: TextButton(
                onPressed: _busy ? null : () => setState(() => _amount.text = widget.balance.toApi()),
                child: const Text('Full'),
              ),
            ),
            onChanged: (_) => setState(() => _error = null),
          ),
          if (_method != PaymentMethod.cash) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _reference,
              enabled: !_busy,
              decoration: const InputDecoration(labelText: 'Reference (optional)', hintText: 'UPI ref / card slip / transfer id'),
            ),
          ],
          if (_error != null) ...[const SizedBox(height: 12), Text(_error!, style: TextStyle(color: theme.colorScheme.error))],
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _busy ? null : _submit,
            icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check),
            label: Text(parsed != null && parsed.isPositive ? 'Record ${money.format(parsed)}' : 'Record payment'),
          ),
        ],
      ),
    );
  }

  static IconData _icon(PaymentMethod m) => switch (m) {
    PaymentMethod.cash => Icons.payments_outlined,
    PaymentMethod.card => Icons.credit_card,
    PaymentMethod.upi => Icons.qr_code_2,
    PaymentMethod.bankTransfer => Icons.account_balance_outlined,
    PaymentMethod.other => Icons.more_horiz,
  };
}
