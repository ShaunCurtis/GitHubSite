---
title: A Blazor Modal Dialog
oneliner: A Modal Dialog for Blazor.
precis: This article describes how to build a modal dialog for Blazor that you can use with any form.
date: 2021-06-25
published: 2020-10-23
---

# A Simple Modal Dialog for Blazor

## Overview

If a web based SPA [Single Page Application] is goinfg to look like a a real application it needs a modal dialog framework.  This article shows how to build a modal dialog container for Blazor `IComponents`.

## Code and Examples

The component is part of my Application Framework Library `Blazor.Database` avaliable on Github at [Blazor.Database Repo](https://github.com/ShaunCurtis/Blazor.Database).  

You can see a live version of the site here [CEC.Blazor WASM Site](https://cec-blazor-database.azurewebsites.net/) - look at *Modal Weather*.

## The Modal Dialog Classes

There are three classes, one interface and one Enum:

1. `IModalDialog`
2. `BaseModalDialog`
3. `ModalOptions`
4. `ModalResult`
5. `ModalResultType`


### IModal

`IModalDialog` defines an interface that all modal dialogs must implementation.

```csharp
namespace Blazr.Modal
{
    public interface IModalDialog
    {
        ModalOptions Options { get; set; }

        //  Method to display a Modal Dialog
        Task<ModalResult> ShowAsync<TModal>(ModalOptions options) where TModal : IComponent;

        // Method to update the Modal Dialog during display
        void Update(ModalOptions options = null);

        // Method to dismiss - normally called by the dismiss button in the header bar
        void Dismiss();

        // Method to close the dialog - normally called by the child component TModal
        void Close(ModalResult result);
    }
}
```

### ModalResultType

```csharp
namespace Blazr.Modal
{
    // Defines the types for exiting the dialog
    public enum ModalResultType
    {
        NoSet,
        OK,
        Cancel,
        Exit
    }
}
```

### ModalResult

`ModalResult` is passed back to the `Show` caller as the `Task` completion result when the modal closes.

```csharp
namespace Blazr.Modal
{
    public class ModalResult
    {
        // The closing type
        public BootstrapModalResultType ResultType { get; private set; } = ModalResultType.NoSet;

        // Whatever object you wish to pass back
        public object Data { get; set; } = null;

        // A set of static methods to build a BootstrapModalResult

        public static ModalResult OK() => new ModalResult() {ResultType = ModalResultType.OK };

        public static ModalResult Exit() => new ModalResult() {ResultType = ModalResultType.Exit};

        public static ModalResult Cancel() => new ModalResult() {ResultType = ModalResultType.Cancel };

        public static ModalResult OK(object data) => new ModalResult() { Data = data, ResultType = ModalResultType.OK };

        public static ModalResult Exit(object data) => new ModalResult() { Data = data, ResultType = ModalResultType.Exit };

        public static ModalResult Cancel(object data) => new ModalResult() { Data = data, ResultType = ModalResultType.Cancel };
    }
}
```
### ModalOptions

`ModalOptions` is an `IEnumerable` collection of options passed to the Modal Dialog class when opening the Dialog.

```csharp
namespace Blazr.Modal
{   public class ModalOptions :IEnumerable<KeyValuePair<string, object>>
    {
        /// <summary>
        /// List of options
        /// </summary>
        public static readonly string __Width = "Width";
        public static readonly string __ID = "ID";
        public static readonly string __ExitOnBackGroundClick = "ExitOnBackGroundClick";

        private Dictionary<string, object> Parameters { get; } = new Dictionary<string, object>();

        public IEnumerator<KeyValuePair<string, object>> GetEnumerator()
        {
            foreach (var item in Parameters)
                yield return item;
        }

        IEnumerator IEnumerable.GetEnumerator()
            => this.GetEnumerator();

        public T Get<T>(string key)
        {
            if (this.Parameters.ContainsKey(key))
            {
                if (this.Parameters[key] is T t) return t;
            }
            return default;
        }

        public bool TryGet<T>(string key, out T value)
        {
            value = default;
            if (this.Parameters.ContainsKey(key))
            {
                if (this.Parameters[key] is T t)
                {
                    value = t;
                    return true;
                }
            }
            return false;
        }

        public bool Set(string key, object value)
        {
            if (this.Parameters.ContainsKey(key))
            {
                this.Parameters[key] = value;
                return false;
            }
            this.Parameters.Add(key, value);
            return true;
        }
    }
}
```
### BaseModalDialog

The Razor Markup for `BaseModalDialog` implements the markup for a dialog.  A cascading value provides child form access to the `IModalDialog` instance. 

```csharp
@namespace Blazr.Modal
@inherits ComponentBase
@implements IModalDialog

@if (this.Display)
{
    <CascadingValue Value="(IModalDialog)this">
        <div class="base-modal-background" @onclick="OnBackClick">
            <div class="base-modal-content" style="@this.Width" @onclick:stopPropagation="true">
                @this._Content
            </div>
        </div>
    </CascadingValue>
}
```

Some key points:
1. The component is initialised when the View is created and added to the RenderTree.  At this point it empty and hidden.
2. There's no need for multiple copies in different forms.  When "hidden" there's no form loaded.  Calling `Show<TForm>`, with the form to display defined as `TForm`, shows the dialog with an instance of `TForm` as it's child content.
3. The component hides itself.  Either the child form calls `Close` on the cascaded `IModalDialog` instance, or the modal calls `Dismiss`.  Both actions set the Task to completed, `Display` to false,  clear the content, and call `Render` which renders an empty component.
4. The component uses a `TaskCompletionSource` object to manage async behaviour and communicate task status to the caller.

```csharp
namespace Blazr.Modal
{
    public partial class BaseModalDialog : ComponentBase, IModalDialog
    {
        [Inject] private IJSRuntime _js { get; set; }

        public ModalOptions Options { get; protected set; } = new ModalOptions();

        public bool Display { get; protected set; }

        public bool IsLocked { get; protected set; }

        protected RenderFragment _Content { get; set; }

        protected string Width => this.Options.TryGet<string>(ModalOptions.__Width, out string value) ? $"width:{value}" : string.Empty;

        protected bool ExitOnBackGroundClick => this.Options.TryGet<bool>(ModalOptions.__ExitOnBackGroundClick, out bool value) ? value : false;

        protected TaskCompletionSource<ModalResult> _ModalTask { get; set; } = new TaskCompletionSource<ModalResult>();

        public Task<ModalResult> ShowAsync<TModal>(ModalOptions options) where TModal : IComponent
        {
            this.Options = options ??= this.Options;
            this._ModalTask = new TaskCompletionSource<ModalResult>();
            this._Content = new RenderFragment(builder =>
            {
                builder.OpenComponent(1, typeof(TModal));
                builder.CloseComponent();
            });
            this.Display = true;
            InvokeAsync(StateHasChanged);
            return this._ModalTask.Task;
        }

        /// <summary>
        /// Method to update the state of the display based on UIOptions
        /// </summary>
        /// <param name="options"></param>
        public void Update(ModalOptions options = null)
        {
            this.Options = options ??= this.Options;
            InvokeAsync(StateHasChanged);
        }

        /// Method called by the dismiss button to close the dialog
        /// sets the task to complete, show to false and renders the component (which hides it as show is false!)
        public async void Dismiss()
        {
            _ = this._ModalTask.TrySetResult(ModalResult.Cancel());
            this.Display = false;
            this._Content = null;
            await InvokeAsync(StateHasChanged);
        }

        /// Method called by child components through the cascade value of this component
        /// sets the task to complete, show to false and renders the component (which hides it as show is false!)
        public async void Close(ModalResult result)
        {
            _ = this._ModalTask.TrySetResult(result);
            this.Display = false;
            this._Content = null;
            await InvokeAsync(StateHasChanged);
        }

        private void SetPageExitCheck(bool action)
        {
            _js.InvokeAsync<bool>("cecblazor_setEditorExitCheck", action);
        }

        public void Lock(bool setlock)
        {
            if (setlock && !this.IsLocked)
            {
                this.IsLocked = true;
                this.SetPageExitCheck(true);
            }
            else if (this.IsLocked && !setlock)
            {
                this.IsLocked = false;
                this.SetPageExitCheck(false);
            }
        }

        private void OnBackClick(MouseEventArgs e)
        {
            if (ExitOnBackGroundClick && !IsLocked)
                this.Close(ModalResult.Exit());
        }
    }
}
```
Next we add some component Css as *BasModalDialog.razor.css*.

```css
div.base-modal-background {
    display: block;
    position: fixed;
    z-index: 1; /* Sit on top */
    left: 0;
    top: 0;
    width: 100%; /* Full width */
    height: 100%; /* Full height */
    overflow: auto; /* Enable scroll if needed */
    background-color: rgb(0,0,0); /* Fallback color */
    background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
}

div.base-modal-content {
    background-color: #fefefe;
    margin: 10% auto;
    padding: 10px;
    border: 2px solid #888;
    width: 90%;
}
```

Finally we need to set up some JsInterop to handle browser exit locking.  Add a *site.js* file to *wwwroot*

```js
window.cecblazor_setEditorExitCheck = function (show) {
    if (show) {
        window.addEventListener("beforeunload", cecblazor_showExitDialog);
    }
    else {
        window.removeEventListener("beforeunload", cecblazor_showExitDialog);
    }
}

window.cecblazor_showExitDialog = function (event) {
    event.preventDefault();
    event.returnValue = "There are unsaved changes on this page.  Do you want to leave?";
}
```

And add a reference to the SPA startup page - _Host.cshtml or index.html:

```html
    <script src="/site.js"></script>
```

## Implementing Modals

We will demonstrate using the modal dialog with two examples:
1. Displaying the FetchData page in a modal dialog.
2. A Pseudo editor page

### Inital Setup

1. Start with a standard Blazor Server template site.  
2. Set up the five classes/interfaces/emuns above.
3. Add the `Blazr.Dialog` namespace to `_Imports.razor`.

### Modify FetchData

```html
@page "/fetchdata"

.....

    @if (this.isDialog)
    {
        <div class="text-right"> <button class="btn btn-dark" @onclick="Exit">Exit</button></div>
    }
}
```
```csharp
@code {

    [CascadingParameter] IModalDialog Dialog { get; set; }

    private bool isDialog => Dialog is not null;

    private List<WeatherForecast> forecasts;

    private void Exit()
    {
        this.Dialog.Dismiss();
    }
    .....
}
```

### Modify Index.razor

```html
@page "/"

<button class="btn btn-primary" @onclick="ShowModal">Show FetchData</button>
<BaseModalDialog @ref="Dialog" />
```
```csharp
@code {
    public IModalDialog Dialog { get; set; }

    private void ShowModal()
        => Dialog.ShowAsync<FetchData>( new Blazr.Modal.ModalOptions());
}
```

### Form using BootstrapModal

This demonstrates using an edit form in a dialog.

First the component - *PseudoEditor.Razor*

Use the "Set To Dirty" button to emulate making edits in the form.

```html
<h3>PseudoEditor</h3>

<div> DATA</div>

<div class="p-2 m-2 text-right">
    <button class="btn @this._editButtonColour" @onclick="this.SetToEdit">@this._editButtonText</button>
    <button disabled="@(!this._isDirty)" class="btn btn-success" @onclick="this.Save">Save</button>
    <button disabled="@(this._isDirty)" class="btn btn-dark" @onclick="this.Close">Close</button>
</div>

@code {
    [CascadingParameter]
    public IModalDialog Modal { get; set; }

    private bool _isModal => this.Modal != null;

    private bool _isDirty;

    private string _editButtonColour => _isDirty ? "btn-danger" : "btn-success";

    private string _editButtonText => _isDirty ? "Set To Clean" : "Set To Dirty";

    private void SetToEdit()
    {
        _isDirty = !_isDirty;
        if (_isModal)
            this.Modal.Lock(_isDirty);
    }

    private void Save(MouseEventArgs e)
    {
        this.Modal.Close(ModalResult.OK());
    }

    public void Close(MouseEventArgs e)
    {
        this.Modal.Close(ModalResult.OK());
    }
}
```
The test page:

```html
@page "/modal"

<div>
    <button class="btn btn-primary" @onclick="GetYesNo">Open</button>
</div>
<BaseModalDialog @ref="this.Modal"></BaseModalDialog>
@code
{
    private BaseModalDialog Modal { get; set; }

    private void GetYesNo(MouseEventArgs e)
    {
        var options = new ModalOptions();
        options.Set(ModalOptions.__ExitOnBackGroundClick, true);
        Modal.ShowAsync<PseudoEditor>(options);
    }
}
```

## Wrap Up

Modal dialogs are just CSS.  You implement them using layers.  The modal background is a full browser sized layer that covers and "hides" everything below it.  The modal content sits on top, and is the only "live" content.

If your looking for a more complex Modal Dialog with more features, take a look at [Blazored Modal Dialog](https://github.com/Blazored/Modal).
