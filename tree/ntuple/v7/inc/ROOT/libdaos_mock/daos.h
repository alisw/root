/*
 * (C) Copyright 2016-2018 Intel Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * \file
 *
 * This file is a reduced version of `daos_xxx.h` headers that provides (simplified) declarations for use in libdaos_mock.
 */

#ifndef __DAOS_H__
#define __DAOS_H__
extern "C" {


//////////////////////////////////////////////////////////////////////////////// daos_types.h


#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <uuid/uuid.h>

/** iovec for memory buffer */
typedef struct {
	void		*iov_buf;
	size_t		iov_buf_len;
	size_t		iov_len;
} d_iov_t;

typedef struct {
	char		unused; // silence [-Wextern-c-compat]
} d_rank_list_t;

/** Scatter/gather list for memory buffers */
typedef struct {
	uint32_t	sg_nr;
	uint32_t	sg_nr_out;
	d_iov_t		*sg_iovs;
} d_sg_list_t;

static inline void d_iov_set(d_iov_t *iov, void *buf, size_t size)
{
	iov->iov_buf = buf;
	iov->iov_len = iov->iov_buf_len = size;
}

typedef uint64_t	daos_size_t;

/** Generic handle for various DAOS components like container, object, etc. */
typedef struct {
	uint64_t	cookie;
} daos_handle_t;

#define DAOS_HDL_INVAL	((daos_handle_t){0})
#define DAOS_TX_NONE	DAOS_HDL_INVAL

#define DAOS_PC_RO	(1U << 0)
#define DAOS_PC_RW	(1U << 1)
#define DAOS_PC_EX	(1U << 2)

typedef d_iov_t daos_key_t;

/** Event and event queue */
typedef struct daos_event {
	int			ev_error;
	struct {
		uint64_t	space[19];
	}			ev_private;
	uint64_t		ev_debug;
} daos_event_t;

/** Wait for completion event forever */
#define DAOS_EQ_WAIT            -1
/** Always return immediately */
#define DAOS_EQ_NOWAIT          0


//////////////////////////////////////////////////////////////////////////////// daos_event.h


int daos_eq_create(daos_handle_t *eqh);
int daos_eq_destroy(daos_handle_t eqh, int flags);
int daos_eq_poll(daos_handle_t eqh, int wait_running,
	     int64_t timeout, unsigned int nevents, daos_event_t **events);
int daos_event_init(daos_event_t *ev, daos_handle_t eqh, daos_event_t *parent);
int daos_event_fini(daos_event_t *ev);


//////////////////////////////////////////////////////////////////////////////// daos_obj_class.h


/** Predefined object classes */
enum {
	OC_UNKNOWN	= 0,
	OC_BACK_COMPAT	= 50,
	OC_TINY,
	OC_SMALL,
	OC_LARGE,
	OC_MAX,

	/** object classes protected by replication */
	OC_RP_TINY	= 60,
	OC_RP_SMALL,
	OC_RP_LARGE,
	OC_RP_MAX,

	/** Object classes protected by replication which supports Scalable Fetch (SF) */
	OC_RP_SF_TINY	= 70,
	OC_RP_SF_SMALL,
	OC_RP_SF_LARGE,
	OC_RP_SF_MAX,

	/** Replicated object class which is extremely scalable for fetch. */
	OC_RP_XSF	= 80,

	/** Object classes protected by erasure code */
	OC_EC_TINY	= 100,
	OC_EC_SMALL,
	OC_EC_LARGE,
	OC_EC_MAX,

	/** Object classes with explicit layout */
	OC_S1		= 200,
	OC_S2,
	OC_S4,
	OC_S8,
	OC_S16,
	OC_S32,
	OC_S64,
	OC_S128,
	OC_S256,
	OC_S512,
	OC_S1K,
	OC_S2K,
	OC_S4K,
	OC_S8K,
	OC_SX,

	/** Replicated object with explicit layout */
	/** 2-way replicated object classes */
	OC_RP_2G1	= 220,
	OC_RP_2G2,
	OC_RP_2G4,
	OC_RP_2G8,
	OC_RP_2G16,
	OC_RP_2G32,
	OC_RP_2G64,
	OC_RP_2G128,
	OC_RP_2G256,
	OC_RP_2G512,
	OC_RP_2G1K,
	OC_RP_2G2K,
	OC_RP_2G4K,
	OC_RP_2G8K,
	OC_RP_2GX,

	/** 3-way replicated object classes */
	OC_RP_3G1	= 240,
	OC_RP_3G2,
	OC_RP_3G4,
	OC_RP_3G8,
	OC_RP_3G16,
	OC_RP_3G32,
	OC_RP_3G64,
	OC_RP_3G128,
	OC_RP_3G256,
	OC_RP_3G512,
	OC_RP_3G1K,
	OC_RP_3G2K,
	OC_RP_3G4K,
	OC_RP_3G8K,
	OC_RP_3GX,

	/** 8-way replicated object classes */
	OC_RP_8G1	= 260,
	OC_RP_8G2,
	OC_RP_8G4,
	OC_RP_8G8,
	OC_RP_8G16,
	OC_RP_8G32,
	OC_RP_8G64,
	OC_RP_8G128,
	OC_RP_8G256,
	OC_RP_8G512,
	OC_RP_8G1K,
	OC_RP_8G2K,
	OC_RP_8G4K,
	OC_RP_8G8K,
	OC_RP_8GX,

	/** Erasure coded object with explicit layout */
	/** EC 2+1 object classes */
	OC_EC_2P1G1	= 280,
	OC_EC_2P1G2,
	OC_EC_2P1G4,
	OC_EC_2P1G8,
	OC_EC_2P1G16,
	OC_EC_2P1G32,
	OC_EC_2P1G64,
	OC_EC_2P1G128,
	OC_EC_2P1G256,
	OC_EC_2P1G512,
	OC_EC_2P1G1K,
	OC_EC_2P1G2K,
	OC_EC_2P1G4K,
	OC_EC_2P1G8K,
	OC_EC_2P1GX,

	/** EC 2+2 object classes */
	OC_EC_2P2G1	= 300,
	OC_EC_2P2G2,
	OC_EC_2P2G4,
	OC_EC_2P2G8,
	OC_EC_2P2G16,
	OC_EC_2P2G32,
	OC_EC_2P2G64,
	OC_EC_2P2G128,
	OC_EC_2P2G256,
	OC_EC_2P2G512,
	OC_EC_2P2G1K,
	OC_EC_2P2G2K,
	OC_EC_2P2G4K,
	OC_EC_2P2G8K,
	OC_EC_2P2GX,

	/** EC 4+1 object classes */
	OC_EC_4P1G1	= 320,
	OC_EC_4P1G2,
	OC_EC_4P1G4,
	OC_EC_4P1G8,
	OC_EC_4P1G16,
	OC_EC_4P1G32,
	OC_EC_4P1G64,
	OC_EC_4P1G128,
	OC_EC_4P1G256,
	OC_EC_4P1G512,
	OC_EC_4P1G1K,
	OC_EC_4P1G2K,
	OC_EC_4P1G4K,
	OC_EC_4P1G8K,
	OC_EC_4P1GX,

	/** EC 4+2 object classes */
	OC_EC_4P2G1	= 340,
	OC_EC_4P2G2,
	OC_EC_4P2G4,
	OC_EC_4P2G8,
	OC_EC_4P2G16,
	OC_EC_4P2G32,
	OC_EC_4P2G64,
	OC_EC_4P2G128,
	OC_EC_4P2G256,
	OC_EC_4P2G512,
	OC_EC_4P2G1K,
	OC_EC_4P2G2K,
	OC_EC_4P2G4K,
	OC_EC_4P2G8K,
	OC_EC_4P2GX,

	/** EC 8+1 object classes */
	OC_EC_8P1G1	= 360,
	OC_EC_8P1G2,
	OC_EC_8P1G4,
	OC_EC_8P1G8,
	OC_EC_8P1G16,
	OC_EC_8P1G32,
	OC_EC_8P1G64,
	OC_EC_8P1G128,
	OC_EC_8P1G256,
	OC_EC_8P1G512,
	OC_EC_8P1G1K,
	OC_EC_8P1G2K,
	OC_EC_8P1G4K,
	OC_EC_8P1G8K,
	OC_EC_8P1GX,

	/** EC 8+2 object classes */
	OC_EC_8P2G1	= 380,
	OC_EC_8P2G2,
	OC_EC_8P2G4,
	OC_EC_8P2G8,
	OC_EC_8P2G16,
	OC_EC_8P2G32,
	OC_EC_8P2G64,
	OC_EC_8P2G128,
	OC_EC_8P2G256,
	OC_EC_8P2G512,
	OC_EC_8P2G1K,
	OC_EC_8P2G2K,
	OC_EC_8P2G4K,
	OC_EC_8P2G8K,
	OC_EC_8P2GX,

	/** EC 16+1 object classes */
	OC_EC_16P1G1	= 400,
	OC_EC_16P1G2,
	OC_EC_16P1G4,
	OC_EC_16P1G8,
	OC_EC_16P1G16,
	OC_EC_16P1G32,
	OC_EC_16P1G64,
	OC_EC_16P1G128,
	OC_EC_16P1G256,
	OC_EC_16P1G512,
	OC_EC_16P1G1K,
	OC_EC_16P1G2K,
	OC_EC_16P1G4K,
	OC_EC_16P1G8K,
	OC_EC_16P1GX,

	/** EC 16+2 object classes */
	OC_EC_16P2G1	= 420,
	OC_EC_16P2G2,
	OC_EC_16P2G4,
	OC_EC_16P2G8,
	OC_EC_16P2G16,
	OC_EC_16P2G32,
	OC_EC_16P2G64,
	OC_EC_16P2G128,
	OC_EC_16P2G256,
	OC_EC_16P2G512,
	OC_EC_16P2G1K,
	OC_EC_16P2G2K,
	OC_EC_16P2G4K,
	OC_EC_16P2G8K,
	OC_EC_16P2GX,

	/** Class ID equal or higher than this is reserved */
	OC_RESERVED		= (1U << 10),
};

typedef uint16_t		daos_oclass_id_t;
typedef uint16_t		daos_ofeat_t;


//////////////////////////////////////////////////////////////////////////////// daos_obj.h


typedef struct {
	uint64_t	lo;
	uint64_t	hi;
} daos_obj_id_t;

#define OID_FMT_VER		1

#define OID_FMT_INTR_BITS	32
#define OID_FMT_VER_BITS	4
#define OID_FMT_FEAT_BITS	16
#define OID_FMT_CLASS_BITS	(OID_FMT_INTR_BITS - OID_FMT_VER_BITS - \
				 OID_FMT_FEAT_BITS)

#define OID_FMT_VER_SHIFT	(64 - OID_FMT_VER_BITS)
#define OID_FMT_FEAT_SHIFT	(OID_FMT_VER_SHIFT - OID_FMT_FEAT_BITS)
#define OID_FMT_CLASS_SHIFT	(OID_FMT_FEAT_SHIFT - OID_FMT_CLASS_BITS)

enum {
	DAOS_OF_DKEY_UINT64	= (1 << 0),
	DAOS_OF_AKEY_UINT64	= (1 << 2),
	DAOS_OF_ARRAY_BYTE	= (1 << 7),
};

enum {
	DAOS_COND_DKEY_INSERT	= (1 << 1),
};

/** Object open modes */
enum {
	DAOS_OO_RO             = (1 << 1),
	DAOS_OO_RW             = (1 << 2),
};

typedef struct {
	uint64_t	rx_idx;
	uint64_t	rx_nr;
} daos_recx_t;

/** Type of the value accessed in an IOD */
typedef enum {
	DAOS_IOD_SINGLE		= 1,
} daos_iod_type_t;

typedef struct {
	daos_key_t		iod_name;
	daos_iod_type_t		iod_type;
	daos_size_t		iod_size;
	unsigned int		iod_nr;
	daos_recx_t		*iod_recxs;
} daos_iod_t;

typedef struct {
	char		unused; // silence [-Wextern-c-compat]
} daos_iom_t;

enum {
	/** Any record size, it is used by fetch */
	DAOS_REC_ANY		= 0,
};

static inline int daos_obj_generate_id(daos_obj_id_t *oid, daos_ofeat_t ofeats,
		     daos_oclass_id_t cid, uint32_t args)
{
	(void)args;
	uint64_t hdr;

	/* TODO: add check at here, it should return error if user specified
	 * bits reserved by DAOS
	 */
	oid->hi &= (1ULL << OID_FMT_INTR_BITS) - 1;
	/**
	 * | Upper bits contain
	 * | OID_FMT_VER_BITS (version)		 |
	 * | OID_FMT_FEAT_BITS (object features) |
	 * | OID_FMT_CLASS_BITS (object class)	 |
	 * | 96-bit for upper layer ...		 |
	 */
	hdr  = ((uint64_t)OID_FMT_VER << OID_FMT_VER_SHIFT);
	hdr |= ((uint64_t)ofeats << OID_FMT_FEAT_SHIFT);
	hdr |= ((uint64_t)cid << OID_FMT_CLASS_SHIFT);
	oid->hi |= hdr;

	return 0;
}

int daos_obj_open(daos_handle_t coh, daos_obj_id_t oid, unsigned int mode,
	      daos_handle_t *oh, daos_event_t *ev);
int daos_obj_close(daos_handle_t oh, daos_event_t *ev);
int daos_obj_fetch(daos_handle_t oh, daos_handle_t th, uint64_t flags,
	       daos_key_t *dkey, unsigned int nr, daos_iod_t *iods,
	       d_sg_list_t *sgls, daos_iom_t *ioms, daos_event_t *ev);
int daos_obj_update(daos_handle_t oh, daos_handle_t th, uint64_t flags,
		daos_key_t *dkey, unsigned int nr, daos_iod_t *iods,
		d_sg_list_t *sgls, daos_event_t *ev);


//////////////////////////////////////////////////////////////////////////////// daos_prop.h


/** daos properties, for pool or container */
typedef struct {
	char		unused; // silence [-Wextern-c-compat]
} daos_prop_t;


//////////////////////////////////////////////////////////////////////////////// daos_cont.h


#define DAOS_COO_RO	(1U << 0)
#define DAOS_COO_RW	(1U << 1)

/** Container information */
typedef struct {
	char		unused; // silence [-Wextern-c-compat]
} daos_cont_info_t;

d_rank_list_t *daos_rank_list_parse(const char *str, const char *sep);

int daos_cont_create(daos_handle_t poh, const uuid_t uuid, daos_prop_t *cont_prop,
		 daos_event_t *ev);
int daos_cont_open(daos_handle_t poh, const uuid_t uuid, unsigned int flags,
	       daos_handle_t *coh, daos_cont_info_t *info, daos_event_t *ev);
int daos_cont_close(daos_handle_t coh, daos_event_t *ev);


//////////////////////////////////////////////////////////////////////////////// daos_pool.h


/** Storage pool */
typedef struct {
	char		unused; // silence [-Wextern-c-compat]
} daos_pool_info_t;

int daos_pool_connect(const uuid_t uuid, const char *grp,
		  const d_rank_list_t *svc, unsigned int flags,
		  daos_handle_t *poh, daos_pool_info_t *info, daos_event_t *ev);
int daos_pool_disconnect(daos_handle_t poh, daos_event_t *ev);


//////////////////////////////////////////////////////////////////////////////// daos_errno.h


#define DER_ERR_GURT_BASE 1000
#define DER_INVAL		(DER_ERR_GURT_BASE + 3)
const char *d_errstr(int rc);


//////////////////////////////////////////////////////////////////////////////// daos.h


int daos_init(void);
int daos_fini(void);

}
#endif /* __DAOS_H__ */
