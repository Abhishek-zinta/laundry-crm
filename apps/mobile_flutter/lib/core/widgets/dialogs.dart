import 'package:flutter/material.dart';

/// Yes/no confirmation; false when dismissed.
Future<bool> confirmDialog(BuildContext context, {required String title, required String message, required String action}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Not now')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(action)),
      ],
    ),
  );
  return ok ?? false;
}

/// Asks for a short text (a reason, a tag code, a quantity); null when cancelled.
Future<String?> askText(
  BuildContext context, {
  required String title,
  required String label,
  required String action,
  int minLength = 1,
  int maxLines = 2,
  String initial = '',
  String? hint,
  String? suffix,
  IconData? icon,
  TextInputType? keyboardType,
  TextCapitalization capitalization = TextCapitalization.sentences,
  String cancel = 'Back',
}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _TextPromptDialog(
      title: title,
      label: label,
      action: action,
      cancel: cancel,
      minLength: minLength,
      maxLines: maxLines,
      initial: initial,
      hint: hint,
      suffix: suffix,
      icon: icon,
      keyboardType: keyboardType,
      capitalization: capitalization,
    ),
  );
}

/// Owns its controller so it is disposed only when the dialog has fully left
/// the tree. Disposing when the dialog's future completes is too early: the
/// route is still animating out and the closing keyboard rebuilds the field.
class _TextPromptDialog extends StatefulWidget {
  const _TextPromptDialog({
    required this.title,
    required this.label,
    required this.action,
    required this.cancel,
    required this.minLength,
    required this.maxLines,
    required this.initial,
    this.hint,
    this.suffix,
    this.icon,
    this.keyboardType,
    required this.capitalization,
  });

  final String title;
  final String label;
  final String action;
  final String cancel;
  final int minLength;
  final int maxLines;
  final String initial;
  final String? hint;
  final String? suffix;
  final IconData? icon;
  final TextInputType? keyboardType;
  final TextCapitalization capitalization;

  @override
  State<_TextPromptDialog> createState() => _TextPromptDialogState();
}

class _TextPromptDialogState extends State<_TextPromptDialog> {
  late final _controller = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _valid => _controller.text.trim().length >= widget.minLength;

  void _submit() {
    if (_valid) Navigator.pop(context, _controller.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _controller,
        autofocus: true,
        maxLines: widget.maxLines,
        keyboardType: widget.keyboardType,
        textCapitalization: widget.capitalization,
        textInputAction: widget.maxLines == 1 ? TextInputAction.done : null,
        decoration: InputDecoration(
          labelText: widget.label,
          hintText: widget.hint,
          suffixText: widget.suffix,
          prefixIcon: widget.icon == null ? null : Icon(widget.icon),
        ),
        onChanged: (_) => setState(() {}),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(widget.cancel)),
        FilledButton(onPressed: _valid ? _submit : null, child: Text(widget.action)),
      ],
    );
  }
}
