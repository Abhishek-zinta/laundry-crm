import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session_controller.dart';
import '../../../core/auth/session_models.dart';
import '../../../core/domain/enums.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/format/business_time.dart';
import '../../../core/format/formatters.dart';
import '../../../core/format/money.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/dialogs.dart';
import '../../catalog/data/catalog_models.dart';
import '../domain/cart.dart';
import '../pos_controller.dart';

/// Cart review → discount → due date → payment → create.
class CheckoutPanel extends ConsumerStatefulWidget {
  const CheckoutPanel({super.key, required this.modifiers, required this.onSubmit, this.scroll});
  final List<Modifier> modifiers;
  final VoidCallback onSubmit;
  final ScrollController? scroll;

  @override
  ConsumerState<CheckoutPanel> createState() => _CheckoutPanelState();
}

enum _PayMode { later, now }

class _CheckoutPanelState extends ConsumerState<CheckoutPanel> {
  late _PayMode _payMode;
  late PaymentMethod _method;
  late final TextEditingController _amount;
  late DiscountType? _discountType;
  late final TextEditingController _discount;

  /// Last server totals, shown while a newer preview is loading.
  PricingPreview? _lastPreview;

  @override
  void initState() {
    super.initState();
    final d = ref.read(posControllerProvider);
    _payMode = d?.payment == null ? _PayMode.later : _PayMode.now;
    _method = d?.payment?.method ?? PaymentMethod.cash;
    _amount = TextEditingController(text: d?.payment?.amount.toApi() ?? '');
    _discountType = d?.discount?.type;
    _discount = TextEditingController(text: d?.discount?.value ?? '');
  }

  @override
  void dispose() {
    _amount.dispose();
    _discount.dispose();
    super.dispose();
  }

  PosController get _pos => ref.read(posControllerProvider.notifier);

  void _syncPayment() {
    final amount = Money.tryParse(_amount.text);
    _pos.setPayment(_payMode == _PayMode.now && amount != null && amount.isPositive ? CartPayment(_method, amount) : null);
  }

  void _syncDiscount() {
    final v = _discount.text.trim();
    final valid = _discountType != null && Money.tryParse(v) != null && Money.parse(v).isPositive;
    _pos.setDiscount(valid ? CartDiscount(_discountType!, Money.parse(v).toApi()) : null);
  }

  Future<void> _pickDueDate(DateTime current) async {
    // Pickers work in calendar values; feed them the business-local date/time
    // and turn the choice back into an instant in the business zone.
    final shown = BusinessTime.naive(current);
    final today = BusinessTime.naive(DateTime.now());
    final date = await showDatePicker(
      context: context,
      initialDate: shown,
      firstDate: DateTime(today.year, today.month, today.day),
      lastDate: today.add(const Duration(days: 90)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(shown));
    if (time == null) return;
    _pos.setDueDate(BusinessTime.at(date.year, date.month, date.day, time.hour, time.minute));
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(posControllerProvider);
    if (draft == null) return const SizedBox.shrink();
    final session = ref.watch(sessionProvider);
    final money = ref.watch(moneyFormatProvider);
    final theme = Theme.of(context);
    final preview = ref.watch(pricingPreviewProvider(jsonEncode(draft.toPreviewJson())));
    if (preview.hasValue) _lastPreview = preview.value;
    if (draft.lines.isEmpty) _lastPreview = null;
    final shown = preview.value ?? (preview.isLoading ? _lastPreview : null);
    final total = shown?.grandTotal;
    final blockers = draft.blockers();
    final submitting = ref.watch(posSubmittingProvider);
    final payAmount = Money.tryParse(_amount.text);
    final overpay = _payMode == _PayMode.now && total != null && payAmount != null && payAmount > total;

    return ListView(
      controller: widget.scroll,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      children: [
        Row(
          children: [
            Expanded(child: Text('Cart', style: theme.textTheme.titleLarge)),
            Text('${draft.itemCount} lines · ${draft.pieceCount} pcs', style: theme.textTheme.bodyMedium),
          ],
        ),
        const SizedBox(height: 8),
        if (draft.lines.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: Text('Tap items to add them.')),
          ),
        for (final (i, line) in draft.lines.indexed)
          _LineRow(
            line: line,
            modifiers: widget.modifiers,
            // Server line total (with add-ons) once the preview matches this cart.
            total: shown != null && shown.lines.length == draft.lines.length ? shown.lines[i].lineTotal : null,
          ),

        // Discount
        if (session.can(Perm.ordersDiscount) && draft.lines.isNotEmpty) ...[
          const Divider(height: 24),
          Text('Discount', style: theme.textTheme.titleSmall),
          const SizedBox(height: 8),
          Row(
            children: [
              SegmentedButton<DiscountType?>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: null, label: Text('None')),
                  ButtonSegment(value: DiscountType.percent, label: Text('%')),
                  ButtonSegment(value: DiscountType.fixed, label: Text('Amount')),
                ],
                selected: {_discountType},
                onSelectionChanged: (s) {
                  setState(() => _discountType = s.first);
                  if (s.first == null) _discount.clear();
                  _syncDiscount();
                },
              ),
              const SizedBox(width: 12),
              if (_discountType != null)
                Expanded(
                  child: TextField(
                    controller: _discount,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
                    decoration: InputDecoration(
                      isDense: true,
                      suffixText: _discountType == DiscountType.percent ? '%' : null,
                      hintText: '0',
                    ),
                    onChanged: (_) => _syncDiscount(),
                  ),
                ),
            ],
          ),
        ],

        // Due date
        const Divider(height: 24),
        InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _pickDueDate(draft.dueDate),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.event_outlined),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Due', style: theme.textTheme.titleSmall),
                      Text(Fmt.relativeDue(draft.dueDate), style: theme.textTheme.bodyMedium),
                    ],
                  ),
                ),
                Icon(Icons.edit_calendar_outlined, color: theme.colorScheme.primary),
              ],
            ),
          ),
        ),

        // Payment
        const Divider(height: 24),
        Text('Payment', style: theme.textTheme.titleSmall),
        const SizedBox(height: 8),
        SegmentedButton<_PayMode>(
          segments: const [
            ButtonSegment(value: _PayMode.later, label: Text('Pay later'), icon: Icon(Icons.schedule)),
            ButtonSegment(value: _PayMode.now, label: Text('Pay now'), icon: Icon(Icons.payments_outlined)),
          ],
          selected: {_payMode},
          onSelectionChanged: (s) {
            setState(() {
              _payMode = s.first;
              if (_payMode == _PayMode.now && _amount.text.isEmpty && total != null) _amount.text = total.toApi();
            });
            _syncPayment();
          },
        ),
        if (_payMode == _PayMode.now) ...[
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final m in PaymentMethod.values)
                ChoiceChip(
                  label: Text(m.label),
                  selected: _method == m,
                  onSelected: (_) {
                    setState(() => _method = m);
                    _syncPayment();
                  },
                ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
            decoration: InputDecoration(
              labelText: 'Amount received',
              errorText: overpay ? 'More than the order total' : null,
              helperText: total != null && payAmount != null && payAmount.isPositive && payAmount < total
                  ? 'Partial · ${money.format(total - payAmount)} will be outstanding'
                  : null,
              suffixIcon: total == null
                  ? null
                  : TextButton(
                      onPressed: () {
                        setState(() => _amount.text = total.toApi());
                        _syncPayment();
                      },
                      child: const Text('Full'),
                    ),
            ),
            onChanged: (_) {
              setState(() {});
              _syncPayment();
            },
          ),
        ],

        // Totals
        const Divider(height: 24),
        _Totals(preview: preview, shown: shown, money: money, estimate: draft.baseSubtotal),
        const SizedBox(height: 16),
        if (blockers.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              blockers.first,
              textAlign: TextAlign.center,
              style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
            ),
          ),
        FilledButton.icon(
          onPressed: blockers.isEmpty && !overpay && !submitting && !preview.isLoading ? widget.onSubmit : null,
          icon: submitting
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.check_circle_outline),
          label: Text(total == null ? 'Create order' : 'Create order · ${money.format(total)}'),
        ),
      ],
    );
  }
}

class _LineRow extends ConsumerWidget {
  const _LineRow({required this.line, required this.modifiers, this.total});
  final CartLine line;
  final List<Modifier> modifiers;
  final Money? total;

  Future<void> _editQuantity(BuildContext context, WidgetRef ref) async {
    final text = await askText(
      context,
      title: '${line.item.name} quantity',
      label: 'Quantity',
      action: 'Set',
      cancel: 'Cancel',
      maxLines: 1,
      initial: line.quantity.toApi(),
      suffix: line.item.unitType.label,
      keyboardType: TextInputType.numberWithOptions(decimal: line.item.unitType.allowsFraction),
    );
    final q = text == null ? null : Qty.tryParse(text);
    if (q != null) {
      final whole = line.item.unitType.allowsFraction ? q : Qty((q.milli / 1000).ceil() * 1000);
      ref.read(posControllerProvider.notifier).setQuantity(line.key, whole);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatProvider);
    final theme = Theme.of(context);
    final pos = ref.read(posControllerProvider.notifier);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(line.item.name, style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
                    Text('${line.categoryName} · ${money.format(line.item.price)}', style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
              IconButton(tooltip: 'Less', icon: const Icon(Icons.remove_circle_outline), onPressed: () => pos.stepLine(line.key, -1)),
              InkWell(
                onTap: () => _editQuantity(context, ref),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                  child: Text(
                    '${line.quantity.toApi()}${line.item.unitType == UnitType.kg ? ' kg' : ''}',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              IconButton(tooltip: 'More', icon: const Icon(Icons.add_circle_outline), onPressed: () => pos.stepLine(line.key, 1)),
              SizedBox(width: 76, child: Text(money.format(total ?? line.baseAmount), textAlign: TextAlign.end)),
            ],
          ),
          if (modifiers.isNotEmpty)
            Wrap(
              spacing: 6,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                for (final m in modifiers.where((m) => line.modifierIds.contains(m.id)))
                  InputChip(
                    visualDensity: VisualDensity.compact,
                    label: Text(m.label, style: const TextStyle(fontSize: 12)),
                    onDeleted: () => pos.toggleModifier(line.key, m.id),
                  ),
                PopupMenuButton<String>(
                  tooltip: 'Add-ons',
                  onSelected: (id) => pos.toggleModifier(line.key, id),
                  itemBuilder: (_) => [
                    for (final m in modifiers)
                      CheckedPopupMenuItem(value: m.id, checked: line.modifierIds.contains(m.id), child: Text(m.label)),
                  ],
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add, size: 16, color: theme.colorScheme.primary),
                        Text(
                          'Add-ons',
                          style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _Totals extends StatelessWidget {
  const _Totals({required this.preview, required this.shown, required this.money, required this.estimate});
  final AsyncValue<PricingPreview?> preview;
  final PricingPreview? shown;
  final MoneyFormatter money;
  final Money estimate;

  @override
  Widget build(BuildContext context) {
    final p = shown;
    if (preview.hasError) {
      return Text(
        "Couldn't calculate totals: ${AppException.from(preview.error!).message}",
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      );
    }
    if (p == null) {
      return InfoRow('Estimated subtotal', preview.isLoading ? '…' : money.format(estimate));
    }
    return Column(
      children: [
        InfoRow('Subtotal', money.format(p.subtotal)),
        if (p.discountAmount.isPositive) InfoRow('Discount', '− ${money.format(p.discountAmount)}'),
        if (p.taxAmount.isPositive) InfoRow('Tax', money.format(p.taxAmount)),
        InfoRow('Total', money.format(p.grandTotal), emphasize: true),
        if (preview.isLoading) const LinearProgressIndicator(minHeight: 2),
      ],
    );
  }
}
