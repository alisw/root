/*************************************************************************
 * Copyright (C) 1995-2015, Rene Brun and Fons Rademakers.               *
 * All rights reserved.                                                  *
 *                                                                       *
 * For the licensing terms see $ROOTSYS/LICENSE.                         *
 * For the list of contributors see $ROOTSYS/README/CREDITS.             *
 *************************************************************************/

#ifndef ROOT7_RDrawable
#define ROOT7_RDrawable

#include <memory>
#include <string>
#include <vector>

#include <ROOT/RAttrMap.hxx>
#include <ROOT/RStyle.hxx>


namespace ROOT {
namespace Experimental {

class RMenuItems;
class RPadBase;
class RAttrBase;
class RDisplayItem;
class RIndirectDisplayItem;
class RLegend;
class RCanvas;

namespace Internal {

/** \class RIOSharedBase
\ingroup GpadROOT7
\author Sergey Linev <s.linev@gsi.de>
\date 2019-09-24
\warning This is part of the ROOT 7 prototype! It will change without notice. It might trigger earthquakes. Feedback is welcome!
*/

class RIOSharedBase {
public:
   virtual const void *GetIOPtr() const = 0;
   virtual bool HasShared() const = 0;
   virtual void *MakeShared() = 0;
   virtual void SetShared(void *shared) = 0;
   virtual ~RIOSharedBase() = default;
};

using RIOSharedVector_t = std::vector<RIOSharedBase *>;

template<class T>
class RIOShared final : public RIOSharedBase {
   std::shared_ptr<T>  fShared;  ///<!   holder of object
   T* fIO{nullptr};              ///<    plain pointer for IO
public:
   const void *GetIOPtr() const final { return fIO; }
   virtual bool HasShared() const final { return fShared.get() != nullptr; }
   virtual void *MakeShared() final { fShared.reset(fIO); return &fShared; }
   virtual void SetShared(void *shared) final { fShared = *((std::shared_ptr<T> *) shared); }

   RIOShared() = default;

   RIOShared(const std::shared_ptr<T> &ptr) : RIOSharedBase()
   {
      fShared = ptr;
      fIO = ptr.get();
   }

   RIOShared &operator=(const std::shared_ptr<T> &ptr)
   {
      fShared = ptr;
      fIO = ptr.get();
      return *this;
   }

   operator bool() const { return !!fShared || !!fIO; }

   const T *get() const { return fShared ? fShared.get() : fIO; }
   T *get() { return fShared ? fShared.get() : fIO; }

   const T *operator->() const { return get(); }
   T *operator->() { return get(); }

   std::shared_ptr<T> get_shared() const { return fShared; }

   void reset() { fShared.reset(); fIO = nullptr; }
};

} // namespace Internal


/** \class RDrawable
\ingroup GpadROOT7
\brief Base class for drawable entities: objects that can be painted on a `RPad`.
\author Axel Naumann <axel@cern.ch>
\author Sergey Linev <s.linev@gsi.de>
\date 2015-08-07
\warning This is part of the ROOT 7 prototype! It will change without notice. It might trigger earthquakes. Feedback is welcome!
*/

class RDrawable {

friend class RPadBase; // to access Display method and IsFrameRequired
friend class RAttrBase;
friend class RStyle;
friend class RLegend; // to access CollectShared method
friend class RIndirectDisplayItem;  // to access attributes and other members
friend class RCanvas; // access SetDrawableVersion

public:

using Version_t = uint64_t;

private:
   RAttrMap fAttr;               ///< attributes values
   std::weak_ptr<RStyle> fStyle; ///<! style applied for RDrawable, not stored when canvas is saved
   std::string fCssType;         ///<! drawable type, not stored in the root file, must be initialized in constructor
   std::string fCssClass;        ///< user defined drawable class, can later go inside map
   std::string fId;              ///< optional object identifier, may be used in CSS as well
   Version_t fVersion{1};        ///<! drawable version, changed from the canvas

protected:

   virtual void CollectShared(Internal::RIOSharedVector_t &) {}

   virtual bool IsFrameRequired() const { return false; }

   RAttrMap &GetAttrMap() { return fAttr; }
   const RAttrMap &GetAttrMap() const { return fAttr; }

   bool MatchSelector(const std::string &selector) const;

   virtual std::unique_ptr<RDisplayItem> Display(const RPadBase &, Version_t) const;

   virtual void SetDrawableVersion(Version_t vers) { fVersion = vers; }
   Version_t GetVersion() const { return fVersion; }

public:

   explicit RDrawable(const std::string &type) : fCssType(type) {}

   virtual ~RDrawable();

   // copy constructor and assign operator !!!

   /** Method can be used to provide menu items for the drawn object */
   virtual void PopulateMenu(RMenuItems &) {}

   virtual void Execute(const std::string &);

   virtual void UseStyle(const std::shared_ptr<RStyle> &style) { fStyle = style; }
   void ClearStyle() { UseStyle(nullptr); }

   void SetCssClass(const std::string &cl) { fCssClass = cl; }
   const std::string &GetCssClass() const { return fCssClass; }

   const std::string &GetCssType() const { return fCssType; }

   const std::string &GetId() const { return fId; }
   void SetId(const std::string &id) { fId = id; }
};

/// Central method to insert drawable in list of pad primitives
/// By default drawable placed as is.
template <class DRAWABLE, std::enable_if_t<std::is_base_of<RDrawable, DRAWABLE>{}>* = nullptr>
inline auto GetDrawable(const std::shared_ptr<DRAWABLE> &drawable)
{
   return drawable;
}

class RDrawableReply {
   uint64_t reqid{0}; ///< request id

public:

   void SetRequestId(uint64_t _reqid) { reqid = _reqid; }
   uint64_t GetRequestId() const { return reqid; }

   virtual ~RDrawableReply();
};


class RDrawableRequest {
   std::string id; ///< drawable id
   uint64_t reqid{0}; ///< request id

   const RCanvas *fCanvas{nullptr}; ///<! pointer on canvas, can be used in Process
   const RPadBase *fPad{nullptr};   ///<! pointer on pad with drawable, can be used in Process
   RDrawable *fDrawable{nullptr};   ///<! pointer on drawable, can be used in Process

protected:


   /// Returns canvas assign to request, should be accessed from Process method
   const RCanvas *GetCanvas() const { return fCanvas; }

   /// Returns canvas assign to request, should be accessed from Process method
   const RPadBase *GetPad() const { return fPad; }

   /// Returns drawable assign to request, should be accessed from Process method
   RDrawable *GetDrawable() { return fDrawable; }

public:
   const std::string &GetId() const { return id; }
   uint64_t GetRequestId() const { return reqid; }

   void SetCanvas(const RCanvas *canv) { fCanvas = canv; }
   void SetPad(const RPadBase *pad) { fPad = pad; }
   void SetDrawable(RDrawable *dr) { fDrawable = dr; }

   virtual ~RDrawableRequest();

   virtual std::unique_ptr<RDrawableReply> Process() { return nullptr; }
};





} // namespace Experimental
} // namespace ROOT

#endif
