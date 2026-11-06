/**
 * Browser translation (Chrome's, Google Translate, Edge's) replaces the page's
 * text nodes with its own <font> elements. When React then removes or inserts
 * next to a text node it rendered, that node is no longer where React left it,
 * and the browser throws ("Failed to execute 'removeChild' on 'Node'", in
 * Safari "The object can not be found here"): the page fell to the error
 * screen, for about 80 people a fortnight, almost all with a non-English
 * browser. Here a node that is no longer a child is left alone instead: the
 * translated text stays a little stale, and the page keeps working.
 * See https://github.com/facebook/react/issues/11538.
 */
export const guardAgainstTranslation = () => {
  if (typeof Node !== 'function' || !Node.prototype) return
  const proto = Node.prototype as Node & { __maiaTranslationGuard?: boolean }
  if (proto.__maiaTranslationGuard) return
  proto.__maiaTranslationGuard = true

  const removeChild = proto.removeChild
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child
    return removeChild.call(this, child) as T
  }

  const insertBefore = proto.insertBefore
  proto.insertBefore = function <T extends Node>(
    this: Node,
    node: T,
    child: Node | null,
  ): T {
    if (child && child.parentNode !== this) return node
    return insertBefore.call(this, node, child) as T
  }
}
